Alto Edit
----------

This website is designed as a demo and is not configurable. To use it generically for your own project some code review is required

To run this alto editor website, first follow the instructions on starting up the cropper and json_alto services

Next, to get this demo up and running:
1) Install apache
2) symlink this folder (static) to your public path (/var/www), using a name of your choosing

All remote references are currently hardcoded, so to change them some code review is required:
All instances of localhost:3000 refer to the cropper service
All instances of localhost:3002 refer to the json_alto converter

There is a same xml file (alto), which is referred to, this is not dynamically retrieved, but this xml file *is* however passed to the json_alto converter service. 

The same goes for the example jpeg file, under the images folder. It is statically retrieved, but it *is* however passed to the cropper service.

NOTE:
The image_client_jp2.js was written to be used as a client for a dynamic JPEG 2000 service. The cropper is just a dummy for and should not be used with large jpeg files.
