#!/usr/bin/ruby

require "rubygems"
require "sinatra"
require "hpricot"
require "json"
require "mongo"
require "src/simple_get_response"

def mongo_connect
	return Mongo::Connection.new.db("dpo_edits_v2")["updates"]
end

def mongo_admin_connect
	return Mongo::Connection.new.db("dpo_edits_v2")["admin"]
end

def line_by_id(alto, key)
	(block_id, line_id, word_id) = key.split(":")
	alto[:blocks].select do |b|
		b[:id] == block_id
	end.first[:lines].select do |l|
		l[:id] == line_id
	end.first
end

def field_by_id(alto, key)
	(block_id, line_id, word_id) = key.split(":")
	alto[:blocks].select do |b|
		b[:id] == block_id
	end.first[:lines].select do |l|
		l[:id] == line_id
	end.first[:strings].select do |s|
		s[:id] == word_id
	end.first
end


def updated(alto, urn, timestamp)
	coll = mongo_connect
	doc = coll.find_one("_id" => urn)
	return alto if doc.nil?

	(doc["inserts"] || []).each do |ins|
		ins.each do |ts, inserts|
			(inserts||[]).each do |key, values|
				line = line_by_id(alto, key)
				line[:strings] << {
					:id => key.gsub(/.+:/,""),
					:hpos => values["hpos"].to_i,
					:vpos => values["vpos"].to_i,
					:height => values["height"].to_i,
					:width => values["width"].to_i,
					:content => values["content"]
				}
				line[:strings] = line[:strings].sort{|a,b| a[:hpos] <=> b[:hpos]}
			end
		end
	end

	(doc["updates"] || []).each do |up|
		up.each do |ts, updates|
			if ts.to_i <= timestamp
				(updates||[]).each do |key, values|
					field = field_by_id(alto, key)
					if field
						values.each do |k,v|
							v = v.to_i if k == "hpos" || k == "width"
							field[k.to_sym] = v
						end
						field[:updated] = true 
					end
				end
			end
		end
	end
	return alto
end

def update_content(doc, key, values, block, line, string)
	if values["content"] && string
	#	values["content"].sub!(/\-\s*$/, "")
		string.set_attribute("CONTENT", values["content"])
		string.set_attribute("WC", "1")
		string.set_attribute("CC", "0" * values["content"].length)
	end
end

def delete_string_nodes(doc, key, values, block, line, string)
	if values["delete"]
		deleted_node = (line/"/String[@ID=#{string.attributes["ID"]}]")
#		deleted_node.after("<!-- #{deleted_node.to_html}-->")
		deleted_node.remove
	end
end

def update_segments(doc, key, values, block, line, string)
	string.set_attribute("HPOS", values["hpos"]) if values["hpos"]
	string.set_attribute("WIDTH", values["width"]) if values["width"]
end

def correct_whitespaces(doc)
	(doc/"SP").remove
	id_it = 1
	(doc/"TextLine").each do |textline|
		strings = (textline/'String')
		(0..strings.length-2).each do |i|
			hpos = strings[i].attributes["HPOS"].to_i + strings[i].attributes["WIDTH"].to_i
			width = strings[i+1].attributes["HPOS"].to_i - hpos
			vpos = ((strings[i].attributes["VPOS"].to_i + strings[i+1].attributes["VPOS"].to_i).to_f / 2.0).to_i
			id = id_it
			strings[i].after(%(<SP VPOS="#{vpos}" HPOS="#{hpos}" ID="SP#{id_it}" WIDTH="#{width}"/>))
			id_it += 1
		end
	end
end

def correct_hyphenation(doc)
	#(/\-\s*$/, "-")
	textlines = (doc/"TextLine")
	(textlines/"String").remove_attr("SUBS_CONTENT")
	(textlines/"String").remove_attr("SUBS_TYPE")
	textlines.each_with_index do |textline, i|
		break if i == textlines.length - 1
		last_in_line = (textline/"String").last
		next_one = (textlines[i+1]/"String").first

		if last_in_line.attributes["CONTENT"] =~ /\-\s*$/
			last_in_line.set_attribute("CONTENT", last_in_line.attributes["CONTENT"].sub(/\-\s*$/, ""))
			last_in_line.set_attribute("SUBS_CONTENT", last_in_line.attributes["CONTENT"] + next_one.attributes["CONTENT"])
			last_in_line.set_attribute("SUBS_TYPE", "HypPart1")
			next_one.set_attribute("SUBS_CONTENT", last_in_line.attributes["CONTENT"] + next_one.attributes["CONTENT"])
			next_one.set_attribute("SUBS_TYPE", "HypPart2")
			if (textline/'HYP').length == 0
				est_hyp_width = (last_in_line.attributes["WIDTH"].to_i / (last_in_line.attributes["CONTENT"].length + 1.5)).to_i
				hpos = last_in_line.attributes["WIDTH"].to_i + last_in_line.attributes["HPOS"].to_i - est_hyp_width
				vpos = last_in_line.attributes["VPOS"].to_i + (last_in_line.attributes["HEIGHT"].to_i / 2).to_i
				last_in_line.after(%(<HYP CONTENT="-" WIDTH="#{est_hyp_width}" HPOS="#{hpos}" VPOS="#{vpos}" />))
			end
		end
	end
end

def insert_alto_nodes(mdoc, timestamp, doc)
	(mdoc["inserts"] || []).each do |ins|
		ins.each do |ts, inserts|
			if ts.to_i <= timestamp
				(inserts||[]).each do |key, values|
					(block_id, line_id, word_id) = key.split(":")
					block = (doc/"//TextBlock[@ID=#{block_id}]").first
					line =  (block/"/TextLine[@ID=#{line_id}]").first
					after = (line/"/String[@ID=#{values["after"].gsub(/.+:/, "")}]").first
					after.after(%(<String ID="#{key.gsub(/.+:/, "")}" WIDTH="#{values["width"]}" HEIGHT="#{values["height"]}" HPOS="#{values["hpos"]}" VPOS="#{values["vpos"]}" CONTENT="#{values["content"]}" />))
				end
			end
		end
	end
end

def update_alto_xml(mdoc, timestamp, doc, update_method)
	mdoc["updates"].each do |up|
		up.each do |ts, updates|
			if ts.to_i <= timestamp
				(updates||[]).each do |key, values|
					(block_id, line_id, word_id) = key.split(":")
					block = (doc/"//TextBlock[@ID=#{block_id}]").first
					line =  (block/"/TextLine[@ID=#{line_id}]").first
					string = (line/"/String[@ID=#{word_id}]").first
					update_method.call(doc, key, values, block, line, string)
				end
			end
		end
	end
end

get "/index" do 
	content_type :xml, 'charset' => 'utf-8'
	coll = mongo_connect
	off = (params[:offset] ? params[:offset].to_i : 0)
	lim = (params[:limit] ? params[:limit].to_i : 50)
	out = "<updates offset=\"#{off}\" limit=\"#{lim}\" total=\"#{coll.count}\">"
	coll.find.skip(off).limit(lim).each do |doc|
		out += "<alto latestUpdateTS=\"#{doc["updates"].last.map{|k,v| k}}\">#{doc["_id"]}</alto>"
	end
	out += "</updates>"
end

get "/:urn/xml" do
	content_type :xml, 'charset' => 'utf-8'
  coll = mongo_connect
	timestamp = params[:timestamp] ? params[:timestamp].to_i : Time.now.to_i
	mdoc = coll.find_one("_id" => params[:urn])
  get = SimpleGetResponse.new("http://resolver.kb.nl/resolve?urn=#{params[:urn]}:alto")
	if get.success?
		doc = Hpricot.XML(get.body)
		if mdoc		
			# Zero run: insert new String nodes
			insert_alto_nodes(mdoc, timestamp, doc)

			# First run: comment out deleted String nodes
			update_alto_xml(mdoc, timestamp, doc, method(:delete_string_nodes))	
			# Second run: update CONTENT attribute
			update_alto_xml(mdoc, timestamp, doc, method(:update_content))
			# Third run: update HPOS and WIDTH attributes
			update_alto_xml(mdoc, timestamp, doc, method(:update_segments))
			# Fourth run: normalize white-spaces
			correct_whitespaces(doc)
			# Fifth run: correct Hyphenation
			correct_hyphenation(doc)

		end
		retval = ""
		doc.output(retval)
		return retval
	end
end

post "/:urn/pageInfo" do
	coll = mongo_admin_connect
	doc = coll.find_one({"urn" => params[:urn]})
	if doc
		@pages = doc["pages"]
		@pages = @pages.select{|p| p["status"] == "new" || p["editor"] == params[:username]}.reject{|p| p["status"] == "done" } if params[:role] == "user"
		@pages = @pages[0..9] if @pages.length > 10 && params[:role] == "user" 
		erb :pageinfo
	else
		"pagina's niet gevonden"
	end
end

post "/updateUser" do
	coll = mongo_admin_connect
	doc = coll.find_one({"urn" => params[:urn].sub(/:[0-9]+$/, ":xml")})
	if doc
		page = doc["pages"].select{|p| p["urn"] == params[:urn]}.first
		if page["editor"] == nil 
			page["editor"] = params[:username]
			page["status"] = "pending"
			coll.save(doc);
		elsif page["editor"] != params[:username] && params[:role] != "admin"
			return page["editor"]
		end
	end
end

get "/:urn/versions" do
	content_type "text/javascript", 'charset' => 'utf-8'
	coll = mongo_connect
	doc = coll.find_one("_id" => params[:urn])
	retstr = JSON doc
	return "#{params[:callback]}(#{retstr});" if params[:callback]
	return retstr
end

get "/:urn" do
	content_type "text/javascript", 'charset' => 'utf-8'
	coll = mongo_connect
	get = SimpleGetResponse.new("http://resolver.kb.nl/resolve?urn=#{params[:urn]}:alto")
	timestamp = params[:timestamp] ? params[:timestamp].to_i : Time.now.to_i
	if get.success?
		doc = Hpricot.XML(get.body)
		alto = {
			:identifier => params[:urn],
			:page_width => (doc/'//Page').first.attributes["WIDTH"].to_i,
			:page_height => (doc/'//Page').first.attributes["HEIGHT"].to_i,
			:blocks => (doc/'//TextBlock').map do |tb| 
				{
					:id => tb.attributes["ID"],
					:hpos => tb.attributes["HPOS"].to_i,
					:vpos => tb.attributes["VPOS"].to_i,
					:width => tb.attributes["WIDTH"].to_i,
					:height => tb.attributes["HEIGHT"].to_i,
					:lines => (tb/'//TextLine').map do |tl|
						{
							:id => tl.attributes["ID"],
							:hpos => tl.attributes["HPOS"].to_i,
							:vpos => tl.attributes["VPOS"].to_i,
							:width => tl.attributes["WIDTH"].to_i,
							:height => tl.attributes["HEIGHT"].to_i,
							:strings => (tl/'//String').map do |s|
								{
									:id => s.attributes["ID"],
									:hpos => s.attributes["HPOS"].to_i,
									:vpos => s.attributes["VPOS"].to_i,
									:height => s.attributes["HEIGHT"].to_i,
									:width => s.attributes["WIDTH"].to_i,
									:content => s.attributes["CONTENT"] + (s == (tl/'//String').last && (tl/'HYP').length == 1 ? "-" : ""),
									:wc => s.attributes["WC"],
									:updated => false
								}
							end
						}
					end
				}
			end
		}

		return "#{params[:callback]}(#{JSON updated(alto, params[:urn], timestamp)});" if params[:callback]
		return JSON updated(alto, params[:urn], timestamp)
	end
end

post "/add_book" do
	urn = params[:urn]
	urn += ":mpeg21" unless urn =~ /mpeg21/
	urn += ":xml" unless urn =~ /xml/
	get = SimpleGetResponse.new("http://resolver.kb.nl/resolve?urn=#{urn}")
	if get.success?
		doc = Hpricot.XML(get.body)
		pages = (doc/'//didl:Item//didl:Item').map{|x| x.attributes["dc:identifier"]}
		if pages.length > 0
			coll = mongo_admin_connect
			if coll.find({"urn" => urn}).count == 0
				coll.save({
					"urn" => urn,
					"title" => (doc/'//dc:title').first.innerText,
					"pages" => pages.map{|page| {
						"urn" => page,
						"editor" => nil,
						"status" => "new"
					}}
				})
				redirect request.referer.sub(/\?.+$/, "") + "?msg=success"
			else
				redirect request.referer.sub(/\?.+$/, "") + "?msg=alreadyAdded"
			end
		else
			redirect request.referer.sub(/\?.+$/, "") + "?msg=badbook"
		end
	else
		redirect request.referer.sub(/\?.+$/, "") + "?msg=badbook"
	end
end

post "/:urn/pageIsNotDone" do
	urn = params[:urn]
	coll = mongo_admin_connect
	doc = coll.find_one({"urn" => urn.sub(/:[0-9]+$/, ":xml")})
	if doc
		page = doc["pages"].select{|p| p["urn"] == urn}.first
		page["status"] = "pending"
		coll.save(doc)
	end
	redirect request.referer 
end

post "/:urn/pageIsDone" do
	urn = params[:urn]
	coll = mongo_admin_connect
	doc = coll.find_one({"urn" => urn.sub(/:[0-9]+$/, ":xml")})
	if doc
		page = doc["pages"].select{|p| p["urn"] == urn}.first
		page["status"] = "done"
		coll.save(doc)
	end
	redirect "/general/alto_edit/overview.php"
end

post "/:urn/:username" do
	if params[:update] || params[:insert]
		coll = mongo_connect
		doc = coll.find_one("_id" => params[:urn])
		doc ||= {"_id" => params[:urn]}
		doc["inserts"] ||= []
		doc["updates"] ||= []
		doc["inserts"] << {Time.now.to_i.to_s => params[:insert]}
		doc["updates"] << {Time.now.to_i.to_s => params[:update]}
		doc["editor"] ||= params[:username]
		coll.save(doc)
	end
	redirect request.referer
end

post "/:urn" do
	if params[:update] || params[:insert]
		coll = mongo_connect
		doc = coll.find_one("_id" => params[:urn])
		doc ||= {"_id" => params[:urn]}
		doc["inserts"] ||= []
		doc["updates"] ||= []
		doc["inserts"] << {Time.now.to_i.to_s => params[:insert]}
		doc["updates"] << {Time.now.to_i.to_s => params[:update]}
		doc["editor"] ||= params[:username]
		coll.save(doc)
	end
	redirect request.referer
end
