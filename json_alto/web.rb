# json_alto/web.rb: Simple converter from ALTO XML to JSON
# For details see: http://opendatachallenge.kbresearch.nl/
# Copyright (C) 2011 R. van der Ark, Koninklijke Bibliotheek - National Library of the Netherlands
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.

require "rubygems"
require "sinatra"
require "hpricot"
require "json"
require "src/simple_get_response"

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



get "/" do
	content_type "text/javascript", 'charset' => 'utf-8'
	get = SimpleGetResponse.new(params[:url])
	timestamp = params[:timestamp] ? params[:timestamp].to_i : Time.now.to_i
	if get.success?
		doc = Hpricot.XML(get.body)
		alto = {
			:identifier => (doc/'//fileName').first.innerText,
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
									:content => s.attributes["CONTENT"],
									:wc => s.attributes["WC"],
									:updated => false
								}
							end
						}
					end
				}
			end
		}

		return "#{params[:callback]}(#{JSON alto});" if params[:callback]
		return JSON alto
	end
end

post "/" do
	content_type :xml
	if params[:url]
		get = SimpleGetResponse.new(params[:url])
		if get.success?
			doc = Hpricot.XML(get.body)
	  	(params[:insert] || []).each do |key, values|
      	    (block_id, line_id, word_id) = key.split(":")
        	  block = (doc/"//TextBlock[@ID=#{block_id}]").first
	          line =  (block/"/TextLine[@ID=#{line_id}]").first
  	        after = (line/"/String[@ID=#{values["after"].gsub(/.+:/, "")}]").first
    	      after.after(%(<String ID="#{key.gsub(/.+:/, "")}" WIDTH="#{values["width"]}" HEIGHT="#{values["height"]}" HPOS="#{values["hpos"]}" VPOS="#{values["vpos"]}" CONTENT="#{values["content"]}" />))
  	  end

			(params[:update] || []).each do |key, values|
			  if values["delete"]
					(block_id, line_id, word_id) = key.split(":")
					block = (doc/"//TextBlock[@ID=#{block_id}]").first
					line =  (block/"/TextLine[@ID=#{line_id}]").first
					string = (line/"/String[@ID=#{word_id}]").first
		  	  deleted_node = (line/"/String[@ID=#{string.attributes["ID"]}]")

			   	deleted_node.after("<!-- #{deleted_node.to_html}-->")
		    	deleted_node.remove
			  end
			end





			updates = params[:update]
			(updates||[]).each do |key, update|
				(block_id, line_id, word_id) = key.split(":")
				block = (doc/"//TextBlock[@ID=#{block_id}]").first
				line =  (block/"/TextLine[@ID=#{line_id}]").first
				string = (line/"/String[@ID=#{word_id}]").first
				if string && string.has_attribute?("SUBS_CONTENT")
					remainder = string.attributes["SUBS_CONTENT"].sub(string.attributes["CONTENT"], "")
					string.set_attribute("SUBS_CONTENT", update["content"] + remainder) if string.attributes["SUBS_TYPE"] == "HypPart1"
					string.set_attribute("SUBS_CONTENT", remainder + update["content"]) if string.attributes["SUBS_TYPE"] == "HypPart2"
				end
				string.set_attribute("CONTENT", update["content"]) if string
  			string.set_attribute("HPOS", update["hpos"]) if string && update["hpos"]
			  string.set_attribute("WIDTH", update["width"]) if string && update["width"]
			end

      # Fourth run: normalize white-spaces
      correct_whitespaces(doc)
      # Fifth run: correct Hyphenation
      correct_hyphenation(doc)

			x = ""
			doc.output(x)
			return x
		end
	end
end
