var ImageClient = Class.create({
	initialize: function(container_id, urn, fullImageDims, words, spinner_src, zc, altUrl, usefullUrl) {
		this.imgUrl = (altUrl ? altUrl : "http://imageviewer.kb.nl/ImagingService/imagingService");
		this.container = $(container_id);
		if(usefullUrl) {
			this.settings = {
				colour: "89c5e7",
				id: urn,
				r: 0,
				s: 0.1,
				x: 0,
				y: 0,
				w: parseInt(this.container.style.width),
				h: parseInt(this.container.style.height),
				useresolver: "false"
  	  }
		} else	{
			this.settings = {
				colour: "89c5e7",
				coords: urn + ":alto",
				words: (words ? words : ""),
				id: urn + ":image",
				r: 0,
				s: 0.1,
				x: 0,
				y: 0,
				w: parseInt(this.container.style.width),
				h: parseInt(this.container.style.height)
  	  }
		}
		
		this.spinner = new Element("img", {
			"src": (spinner_src ? spinner_src : ""),
			"style": "margin-top: " + parseInt(this.container.style.height) / 2 + "; margin-left: " + parseInt(this.container.style.width) / 2
		});
		this.container.insert(this.spinner);
		this.fullImageDims = fullImageDims;
		this.settings.s = parseInt(this.container.style.height) / this.fullImageDims.h;
		this.zoomCorrection = (zc ? zc : 1.0);
		this.locked = false;
		this.bufferedImage = null;
		this.defineCallbacks();
		this.overlays = [];
	},

	updateDims: function() {
		this.settings.w = parseInt(this.container.style.width);
		this.settings.h = parseInt(this.container.style.height)
		this.render();
	},

	render: function() {
		var _this = this;
		if(!this.locked) {
			this.bufferedImage = new Image();
			this.settings.s *= this.zoomCorrection;
			this.bufferedImage.src = this.imgUrl + "?" + Object.toQueryString(this.settings);
			this.settings.s /= this.zoomCorrection;
			this.locked = true;
			this.spinner.show();
			window.setTimeout(function() { _this.render() }, 5);
		} else {
			if(this.bufferedImage.complete) {
				this.spinner.hide();
				this.renderImage();
				this.locked = false;
			} else {
				window.setTimeout(function() { _this.render() }, 5);
			}
		}
	},
	renderImage: function() {
		this.container.style.backgroundImage = "url(" + this.bufferedImage.src  + ")";
		this.container.style.backgroundPosition = "0 0";
		this.renderOverlays();
	},
	zoomIn: function() {
		this.setZoom(this.settings.s * 1.1);
		this.setPosition(this.settings.x, this.settings.y);
		this.render();
	},
	zoomOut: function() {
		this.setZoom(this.settings.s * 0.9);
		this.setPosition(this.settings.x, this.settings.y);
		this.render();
	},
	zoomBack: function(isVertical) {
		if(isVertical)
			this.settings.s = parseInt(this.container.style.width) / this.fullImageDims.w;
		else
			this.settings.s = parseInt(this.container.style.height) / this.fullImageDims.h;
		this.setPosition(0,0);
		this.render();
	},
	setPosition: function(x, y) {
		this.settings.x = x + parseInt(this.container.style.width) > (this.fullImageDims.w * this.settings.s) ? (this.fullImageDims.w * this.settings.s) - parseInt(this.container.style.width) : x;
		this.settings.y = y + parseInt(this.container.style.height) > (this.fullImageDims.h * this.settings.s) ? (this.fullImageDims.h * this.settings.s) - parseInt(this.container.style.height) : y;
		this.settings.x = this.settings.x < 0 ? 0 : this.settings.x;
		this.settings.y = this.settings.y < 0 ? 0 : this.settings.y;
	},
	setZoom: function(z) {
		this.settings.s = z;
	},	
	getZoom: function() {
		return this.settings.s;
	},
	getTop: function() {
		return this.settings.y;
	},
	getLeft: function() {
		return this.settings.x;
	},
	renderAreaBox: function(elem) {
		if(
			parseInt(elem.style.top) > this.container.offsetTop + parseInt(this.container.style.height) ||
			parseInt(elem.style.top) + parseInt(elem.style.height) < this.container.offsetTop ||
			parseInt(elem.style.left) > this.container.offsetLeft + parseInt(this.container.style.width) ||
			parseInt(elem.style.left) + parseInt(elem.style.width) < this.container.offsetLeft 
		)
			elem.hide();
		else {
			var wdiff = (parseInt(elem.style.left) + parseInt(elem.style.width)) - (this.container.offsetLeft + parseInt(this.container.style.width));
			var hdiff = (parseInt(elem.style.top) + parseInt(elem.style.height)) - (this.container.offsetTop + parseInt(this.container.style.height));
			if(wdiff > 0) elem.style.width = parseInt(elem.style.width) - wdiff;
			if(hdiff > 0) elem.style.height = parseInt(elem.style.height) - hdiff;
			var tdiff = parseInt(elem.style.top) - this.container.offsetTop;
			if(tdiff < 0) {
				 elem.style.top = this.container.offsetTop; 
				 elem.style.height = parseInt(elem.style.height) + tdiff; 
			}
			var ldiff = parseInt(elem.style.left) - this.container.offsetLeft;
			if(ldiff < 0) {
				 elem.style.left = this.container.offsetLeft; 
				 elem.style.width = parseInt(elem.style.width) + ldiff; 
			}
			elem.show();
		}
	},
	hideOverlays: function() {
		this.overlays.each(function(o) { o.div.hide()});
	},
	renderOverlays: function() {
		var _this = this;
		this.overlays.each(function(hl) {
			hl.div.style.width = hl.w * _this.settings.s;
			hl.div.style.height = hl.h * _this.settings.s;
			hl.div.style.left = (hl.x * _this.settings.s) + _this.container.offsetLeft - _this.settings.x; 
			hl.div.style.top = (hl.y * _this.settings.s) + _this.container.offsetTop - _this.settings.y;
			_this.renderAreaBox(hl.div);
		});
	},
	addOverlay: function(x, y, w, h, c, mouseover, id, callback) {
		var hlDiv = new Element("div", {
			"id": id ? id : "",
			"style": 
				"position: absolute; background-color: " + c + "; opacity: 0.2; line-height: 0px; filter: alpha(opacity=20);"
		});
		hlDiv.insert("&nbsp;");
		this.container.insert(hlDiv);
		hlDiv.hide();
		if(callback)  hlDiv.observe("click", callback);
		if(mouseover) {
			if(Prototype.Browser.IE) hlDiv.style.filter = "alpha(opacity=0)";
			else hlDiv.style.backgroundColor = "transparent";
			
			hlDiv.observe("mouseover", function(e) { 
				if(Prototype.Browser.IE) this.style.filter = "alpha(opacity=20)";
				else this.style.backgroundColor = c;
				this.style.cursor = "pointer";
			});
			hlDiv.observe("mouseout", function(e) { 
				if(Prototype.Browser.IE) this.style.filter = "alpha(opacity=0)";
				else this.style.backgroundColor = "transparent";
			});
		}
		var hl = {x: x, y: y, w: w, h: h, div: hlDiv};
		this.overlays.push(hl);
		this.renderOverlays();
		return hl;
	},
	dropOverlay: function(hl) {
		hl.div.remove();
	  this.overlays.splice(this.overlays.indexOf(hl), 1);
	},
	defineCallbacks: function() {
		this.lastPosition = null;
		var _this = this;
		this.container.observe("mousedown", function(e) { _this.mouseDown(e); });
		this.container.observe("mousemove", function(e) { _this.mouseMove(e); });
		this.container.observe("mouseup", function(e) { _this.mouseUp(e); });
		var mousewheelevt=(/Firefox/i.test(navigator.userAgent))? "DOMMouseScroll" : "mousewheel";
		if(Prototype.Browser.IE || Prototype.Browser.Opera)
			document.attachEvent("on"+mousewheelevt, function(e){ _this.mouseScroll(e) });
		else
			document.addEventListener(mousewheelevt, function(e){ _this.mouseScroll(e) }, false);
	},
	mouseScroll: function(e) {
		if(e.clientX > this.container.offsetLeft && e.clientY > this.container.offsetTop &&
			e.clientX < this.container.offsetLeft + parseInt(this.container.style.width) &&
			e.clientY < this.container.offsetTop + parseInt(this.container.style.height) && !this.locked) {
			var evt = window.event || e; 
	    var delta = evt.detail ? -(evt.detail) : evt.wheelDelta;
			if(delta < 0)
				this.zoomOut();
			else
				this.zoomIn();
		}
	},
	mouseDown: function(e) {
		if(Prototype.Browser.IE) { e.returnValue = false; } else { e.preventDefault(); }
		this.container.style.cursor = "move";
		this.lastPosition = {x: e.clientX, y: e.clientY};
	},
	mouseMove: function(e) {
		if(Prototype.Browser.IE) { e.returnValue = false; } else { e.preventDefault(); }
		if(this.lastPosition) {
			this.hideOverlays();
			var movement = {x:  this.lastPosition.x - e.clientX, y: this.lastPosition.y - e.clientY};
			this.container.style.backgroundPosition = -(movement.x) + " " + -(movement.y);
		}
	},
	mouseUp: function(e) {
		if(Prototype.Browser.IE) { e.returnValue = false; } else { e.preventDefault(); }
		if(this.lastPosition) {
			var movement = {x:  this.lastPosition.x - e.clientX, y: this.lastPosition.y - e.clientY};
			this.renderOverlays();
			if(movement.x != 0 || movement.y != 0) {
				this.setPosition(this.settings.x + movement.x, this.settings.y + movement.y);
				this.render();
			}
			this.container.style.cursor = "default";
			this.lastPosition = null;
		}
	}
});

