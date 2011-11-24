var image_client = null;
var viewer = null;

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

document.onkeydown = function(e) {
	var code, shift, ctrl = null;
	if(!e) code = window.event.keyCode; else code = e.keyCode || e.which;
	if(!e) ctrl = window.event.ctrlKey; else ctrl = e.ctrlKey;
	if(!e) shift = window.event.shiftKey; else shift = e.shiftKey;

	if(code == 83 && ctrl == 1) { 
		viewer.saveCurrentUpdate(); 
		if(shift == 1) {
			if(confirm("Weet u zeker dat u deze pagina definitief wilt opslaan en verdergaan? Wijzigingen zijn hierna niet meer mogelijk"))
				$('update_form').insert(new Element("input", {"name": "finalize", "value": "true", "type": "hidden"}));
			else
				return false;
		}
		$('image_container').hide(); 
		$('ocr_container').hide(); 
		$('spinner_div').show();

		$('update_form').submit();
		return false;
	}
}

function altoFrom(version) {
	json_alto("reinitAltoText", version);
}


function confirmChanges() {
	viewer.saveCurrentUpdate();
	var i = $$('#update_form input').length - 1;
	if(i > 0) {
		if(confirm("De laatste wijzigingen zijn niet opgeslagen, wilt u eerste de wijzigingen opslaan?")) {
			$('image_container').hide(); $('ocr_container').hide(); $('spinner_div').show();
			$('update_form').submit();
		} else {
			$('image_container').hide(); $('ocr_container').hide(); $('spinner_div').show();
			return true;
		}
	} else {
		$('image_container').hide(); $('ocr_container').hide(); $('spinner_div').show();
		return true;
	}
}

function leadingZero(x) {
	var y = "" + x;
	var retStr = "";
	for(var i = 0; i < 4 - y.length; ++i)
		retStr += "0";
	return retStr + y;
}

function viewport() {
	if(document.body.clientWidth && document.body.clientHeight)
		return {width: document.body.clientWidth, height: document.body.clientHeight};
	else
		return {width: 950, height: 600};
}

function scaleWindows() {
	var dims = viewport();
	[['image_container', 1.9], ['ocr_container', 2.5]].each(function(x) {
		$(x[0]).style.width = (dims.width / x[1]) + "px";
		$(x[0]).style.height = (dims.height - 170) + "px";
		if(image_client && x[0] == 'image_container') 
			image_client.updateDims();					
	});
}

function preventDefault(e) {
	if (e.preventDefault) e.preventDefault();
	return false;
}

