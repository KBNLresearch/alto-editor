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
			updates = params[:update]
			(updates||[]).each do |key, update|
				update.sub!(/\-\s*$/, "")
				(block_id, line_id, word_id) = key.split(":")
				block = (doc/"//TextBlock[@ID=#{block_id}]").first
				line =  (block/"/TextLine[@ID=#{line_id}]").first
				string = (line/"/String[@ID=#{word_id}]").first
				if string.has_attribute?("SUBS_CONTENT")
					remainder = string.attributes["SUBS_CONTENT"].sub(string.attributes["CONTENT"], "")
					string.set_attribute("SUBS_CONTENT", update + remainder) if string.attributes["SUBS_TYPE"] == "HypPart1"
					string.set_attribute("SUBS_CONTENT", remainder + update) if string.attributes["SUBS_TYPE"] == "HypPart2"
				end
				string.set_attribute("CONTENT", update)
			end
			x = ""
			doc.output(x)
			return x
		end
	end
end
