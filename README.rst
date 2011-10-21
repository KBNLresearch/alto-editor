Alto Edit
-----------

Browser based post correction tool for Alto XML files:

This repos contains three parts:

cropper --> ruby sinatra based cropper using image magick gem

json_alto --> ruby sinatra based converter for alto xml files to JSON

static --> client website, the actual tool


Basic setup (for details see the separate subdirs):

1. Run the cropper on port 3000

2. Run json_alto on port 3002

3. On Apache symlink the static dir to /var/www with a name of your choosing


.. image:: https://github.com/impactcentre/alto-editor/blob/master/static/img/Screenshot.png
