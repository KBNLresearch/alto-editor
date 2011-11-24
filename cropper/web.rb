# cropper/web.rb: Simple cropper for image magick
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
#!/usr/bin/ruby

require 'sinatra'
require 'RMagick'
require 'simple_get_response'



get '/' do
	get = SimpleGetResponse.new(params[:url] || params[:id])
	if get.success?
		img = Magick::Image.from_blob(get.body).first
	  img.scale!(params[:s].to_f)
		img.crop!(params[:x].to_i, params[:y].to_i, params[:w].to_i, params[:h].to_i)
		content_type img.mime_type
		return img.to_blob
	end
end
