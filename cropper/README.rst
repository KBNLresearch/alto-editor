Cropper
---------

Allows for zooming and cropping images

To run the alto_edit software out of the box you must first:

0) Prereq imagemagick dev lib:

sudo apt-get install libmagick9-dev

1) Install ruby and the following gems:

sinatra >= 1.1.2 (sudo gem install sinatra)

rmagick >= 2.13.1

2) Run the following command

$ ruby -rubygems web.rb -p3000

