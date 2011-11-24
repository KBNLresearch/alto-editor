var ieKeyCode = 0;

function delKeyPressedIE(e) {
	if(!e) 
		e = window.event;
	ieKeyCode = e.keyCode;
}


var SegEdit = Class.create({
	initialize: function(altoLine, imageClient, lineDiv, altoViewer) {

		var _this = this
		var vp = viewport();
		this.altoViewer = altoViewer;
		this.deletions = [];
		this.resizings = [];
		this.insertions = [];
		this.contentUpdates = [];
		this.origDims = {};
		this.resizeMode = "none";
		this.selectedRect = null;
		this.lastX = 0;
		this.lineDiv = lineDiv;
		this.splittingSegment = null;
		this.wordPart = 0;
		this.altoLine = altoLine;

		var max = 0;
		lineDiv.childElements().each(function(s) {
			if(s.id.match(/appendedword/)) {
				var current = parseInt(s.id.replace(/.+_/, ""));
				max = current >= max ? (current+1) : max;
			}
		});
		this.appendedCount = max;
		
		this.shade = new Element("div", {
			"style": "position: absolute; top:0;left:0;width:" + vp.width + "px;height:" + vp.height + "px; background-color: black; opacity: 0.6; filter: alpha(opacity=60);"
		});
		this.container = new Element("div", {
			"style": "position: absolute; top: 50; left: 50; width:" + (vp.width-100)+"px;height:"+(vp.height-100)+"px;background-color: white;"
		});

		this.delButton = new Element("button", {
			"disabled": true,
			"style": "margin-left: 50px; margin-top: 50px"
		});

		this.delButton.insert("Verwijder segment");
		this.delButton.observe("click", function(e) {
			_this.deleteSegment();
		});

		this.container.insert(this.delButton);

		this.delAllButton = new Element("button");
		this.delAllButton.insert("Verwijder alle lege segmenten");
		this.delAllButton.observe("click", function(e) {
			if(confirm("Weet u zeker dat u alle lege segmenten wilt verwijderen?"))
				_this.deleteEmptySegments();
		});
		this.container.insert(this.delAllButton);

		var imgSettings = {
			x: altoLine.hpos,
			y: altoLine.vpos,
			w: altoLine.width,
			h: altoLine.height,
			s: imageClient.zoomCorrection,
			coords: imageClient.settings.coords,
			id: imageClient.settings.id
		};
		this.img = new Element("div", {
			"style": "background-image: url("+ imageClient.imgUrl + "?" + Object.toQueryString(imgSettings) +");" + 
				"width:" + altoLine.width + "px;" + "height:" + altoLine.height + "px;" +
				"margin-top: 100px; margin-left: 50px"
		});

		if(parseInt(this.img.style.width) > (parseInt(this.container.style.width) - 200)) {
			this.container.style.width = (parseInt(this.img.style.width) + 200) + "px";
			this.shade.style.width = (parseInt(this.container.style.width) + 100) + "px";
		}

		this.splitterDiv = new Element("div", {
			"style": "position: relative; width: 0px; height: " + (parseInt(this.img.style.height) - 4) + "px; border-left: 2px solid black"
		});
		this.splitterDiv.insert("&nbsp;");

		this.img.observe("mousemove", function(e) {
			if(_this.selectedRect && _this.resizeMode != "none")
				return _this.mousemoveOnSelectedRect(_this.selectedRect, e);
		});
		this.img.observe("mouseup", function(e) {
			if(_this.selectedRect && _this.resizeMode != "none")
				_this.resizeMode = "none";
		});

		this.word_container = new Element("div", {
			"style": "width: " + this.img.style.width + "; height: 100px; margin-top: 15px; margin-left: 50px;"
		});

		this.img.insert("&nbsp;");
		this.shade.insert("&nbsp;");
		this.container.insert(this.img);
		this.container.insert(this.word_container);
		$$("body")[0].insert(this.shade);
		$$("body")[0].insert(this.container);
		this.rects = [];
		var _this = this;
		altoLine.strings.each(function(word) {
			var span = lineDiv.childElements().detect(function(e) { return e.id.replace(/.*:/, "") == word.id});
			if(span) {
				var color = span.innerHTML == "&nbsp;" || span.innerHTML == " " ? "red" : "green";
				_this.appendRect(word, span.innerHTML, color);
			}
		});
		this.saveButton = new Element("button");
		this.saveButton.observe("click", function() {
			_this.saveToAltoViewer();
			_this.terminate();
		});
		this.cancelButton = new Element("button", {"style": "margin-left: 50px"});
		this.cancelButton.observe("click", function() {
			_this.terminate();
		});
		this.saveButton.insert("Ok");
		this.cancelButton.insert("Annuleren");
		this.container.insert(this.cancelButton);
		this.container.insert(this.saveButton);
		document.onkeyup = function(e) {
			var code = null;
			if(!e) code = window.event.keyCode;
			else code = e.keyCode || e.which;
			if(code == 46) _this.deleteSegment();
		}
	},

	deleteEmptySegments: function() {
		var emptyRects = this.rects.select(function(r) { return r.style.borderColor.match(/red/) });
		var _this = this;
		emptyRects.each(function(r) {
			_this.selectedRect = r;
			_this.deleteSegment(true);
		});
	},

	deleteSegment: function(noConfirm) {
		if(this.selectedRect && this.selectedRect.style.borderColor.match(/red/) && (noConfirm || confirm("Weet u zeker dat u dit segement wilt verwijderen?"))) {
			this.deletions.push(this.lineDiv.ancestors()[0].id + ":" + this.lineDiv.id + ":" + this.selectedRect.id.replace(":seg", ""));
			this.rects.remove(this.rects.indexOf(this.selectedRect));
			this.selectedRect.remove();
			this.selectedRect = null;
			this.delButton.disabled = true;
		}
	},

	appendRect: function(word, wordContent, color) {
		var _this = this;
		var rect = new Element("div", {
			"style": "background-color: " + color + "; opacity: 0.2; line-height: 0px; filter: alpha(opacity=20);" +
				"height: " + (Prototype.Browser.IE ? parseInt(this.img.style.height) : parseInt(this.img.style.height) - 4) + "px; width: " + word.width + "px;" + "position: absolute;" +
				"top: " + this.img.offsetTop + "px; left: " + (this.img.offsetLeft + (word.hpos - this.altoLine.hpos)) + "px; " +
				"border: 2px solid " + color + ";cursor:pointer",
			"id": word.id + ":seg"
		});
		rect.observe("click", function(e) {
			_this.rectOnClick(this, e, false, color == "red");
		});
		rect.insert("&nbsp;");
		this.img.insert(rect);
		this.rects.push(rect);
		this.origDims[rect.id] = {left: parseInt(rect.style.left), width: parseInt(rect.style.width)};
 
		var word_span = new Element("div", {
			"style": "position: absolute; left: " + rect.style.left,
			"id": word.id + ":segwrd"
		});
		word_span.insert(wordContent);
		this.word_container.insert(word_span);
		rect.observe("mouseover", function(e) {
			word_span.style.color = "green";
		});
		rect.observe("mouseout", function(e) {
			word_span.style.color = "black";
		})
		this.addSplitButtons(word.id, word_span);
	},

	addSplitButtons: function(word_id, word_span) {
		word_span.innerHTML = word_span.innerHTML.replace(/\s+/g, "&nbsp;<button>][</button>");
		var i = 0;
		var _this = this;
		word_span.childElements().each(function(b) {
			b.addClassName("button_" + i);
			b.observe("click", function(e) {
				_this.splitSegment(word_id + ":seg", this);
			});
			i++;
		});
	},

	splitSegment: function(segId, btn) {
		this.rectOnClick($(segId), null, true);
		this.splittingSegment = segId;
		this.wordPart = parseInt(btn.readAttribute("class").replace("button_", ""));
		$(this.splittingSegment).insert(this.splitterDiv);
	},

	splitSegmentAt: function(hpos) {
		var segDiv1 = $(this.splittingSegment);
		var adjustedWidth = (hpos - parseInt(segDiv1.style.left)) - (Prototype.Browser.IE ? 0 : 2);
		var newWidth = parseInt(segDiv1.style.width) - adjustedWidth - (Prototype.Browser.IE ? 0 : 2);
		segDiv1.style.width = adjustedWidth + "px";
		var leftContent = "";
		var wordSpan = $(this.splittingSegment.replace(":seg", ":segwrd"));
		var updatedSegmentId = this.splittingSegment.replace(":seg", "");
		wordSpan.childElements().each(function(btn) { btn.stopObserving("click"); btn.remove(); });
		var rightContent = wordSpan.innerHTML;
		for(var i = 0; i < this.wordPart + 1; ++i) {
			leftContent += rightContent.replace(/&nbsp;.+/, " ");
			rightContent = rightContent.replace(/^.+?&nbsp;/, "");
		}
		rightContent = rightContent.replace(/&nbsp;/g, " ");
		wordSpan.innerHTML = leftContent.strip();
		this.addSplitButtons(updatedSegmentId, wordSpan);
		this.wordPart = null;
		this.splittingSegment = null;
		this.splitterDiv.remove();

		this.rectOnClick(segDiv1);
		this.appendRect({
			"id": "appendedword_" + this.lineDiv.id + "_" + this.appendedCount, 
			"hpos": hpos + this.altoLine.hpos - parseInt(this.img.style.marginLeft), 
			"width": newWidth }, rightContent, "green");

		this.saveResizing(segDiv1);
		this.insertions.push({
			"id": "appendedword_" + this.lineDiv.id + "_" + this.appendedCount,
			"hpos": hpos + 2 + this.altoLine.hpos - parseInt(this.img.style.marginLeft),
			"width": newWidth,
			"vpos": this.altoLine.vpos,
			"height": this.altoLine.height,
			"content": rightContent
		});
		this.contentUpdates.push({
			"id": updatedSegmentId, 
			"content": leftContent.strip()
		});
		this.appendedCount++;
	},

	rectOnClick: function(rect, e, suppressOpacityChange, mayDelete) {
		if(this.splittingSegment) {
	    var absX = e.clientX - this.img.cumulativeOffset()[0] + parseInt(this.img.style.marginLeft) + document.body.scrollLeft;
			this.splitSegmentAt(absX + (Prototype.Browser.IE ? 3 : 0));
		} else {
			var _this = this;
			this.rects.each(function(r) {
				var span = $(r.id.replace(":seg", ":segwrd")) 
				var color = span.innerHTML == "&nbsp;" || span.innerHTML == " " ? "red" : "green";
				
				r.style.border = "2px solid " + color;
				r.style.opacity = "0.2";
				r.style.filter = "alpha(opacity=20)";
				r.style.backgroundColor = color;
				r.style.cursor = "pointer";
				r.stopObserving("mousemove");
				r.stopObserving("mouseup");
				r.stopObserving("mousedown");
			});
			rect.style.border = "2px solid " + rect.style.backgroundColor; 
			if(suppressOpacityChange) {
				rect.style.opacity = "0.6";
				rect.style.filter = "alpha(opacity=60)";
			} else {
				rect.style.opacity = "1.0";
				rect.style.filter = "alpha(opacity=100)";
				rect.style.backgroundColor = "transparent";
			}
			this.selectedRect = rect;
			rect.observe("mousemove", function(e) {	return _this.mousemoveOnSelectedRect(rect, e); });
			rect.observe("mousedown", function(e) {	_this.mousedownOnSelectedRect(rect, e); });
			rect.observe("mouseup", function(e) {	_this.mouseupOnSelectedRect(rect, e); });
			if(mayDelete)
				this.delButton.disabled = false;
			else
				this.delButton.disabled = true;
		}
	},

	delKeyPressed: function(keyCode) {
		if(keyCode == 46)
			this.deleteSegment();
	},

	mousemoveOnSelectedRect: function(rect, e) {
		var margin = 15;
		var relX = e.clientX - rect.cumulativeOffset()[0] + document.body.scrollLeft;
		var absX = e.clientX - this.img.cumulativeOffset()[0] + parseInt(this.img.style.marginLeft) + document.body.scrollLeft;
		var movement = (relX - this.lastX);
		if(this.splittingSegment != null) {
			this.splitterDiv.style.left = relX + "px";
		} else if(this.resizeMode == "none") {
			if(relX < margin) {
				rect.style.cursor = "col-resize";
			} else if(relX > parseInt(rect.style.width) - margin){
				rect.style.cursor = "col-resize";
			} else {
				rect.style.cursor = "pointer";
			}
		} else if(movement != 0) {
			this.img.childElements().each(function(r) { if(r != rect) r.hide()});
			if(this.resizeMode == "w-resize") {
				var oldX = parseInt(rect.style.left);
				rect.style.left = absX + "px";
				rect.style.width = (parseInt(rect.style.width) + (oldX - parseInt(rect.style.left))) + "px";
				$(rect.id.replace(":seg", ":segwrd")).style.left = rect.style.left;
			} else if(this.resizeMode == "e-resize") {
				rect.style.width = (parseInt(rect.style.width) + movement) + "px";
				var resizingId = this.lineDiv.ancestors()[0].id + ":" + this.lineDiv.id + ":" + rect.id.replace(":seg", "");
			}
			this.img.childElements().each(function(r) { if(r != rect) r.show()});
		}

		this.lastX = relX;
		return preventDefault(e);
	},

	mousedownOnSelectedRect: function(rect, e) {
		var margin = 15;
		var relX = e.clientX - rect.cumulativeOffset()[0] + document.body.scrollLeft;
		if(relX < margin) {
			this.resizeMode = "w-resize";
		} else if(relX > parseInt(rect.style.width) - margin){
			this.resizeMode = "e-resize";
		} else {
			this.resizeMode = "pointer";
		}
		this.lastX = relX; 
	},

	saveResizing: function(rect) {
		var _this = this;
		var idPart1 = this.lineDiv.ancestors()[0].id + ":" + this.lineDiv.id + ":";
		var resizing = this.resizings.detect(function(r) { return r.id.replace(idPart1, "") + ":seg" == rect.id});
		if(resizing) {
			resizing.width = parseInt(rect.style.width) - this.origDims[rect.id].width + 2;
			resizing.left = parseInt(rect.style.left) - this.origDims[rect.id].left + 2;
		} else {
			this.resizings.push({
				"id": idPart1 + rect.id.replace(":seg", ""),
				"width": parseInt(rect.style.width) - this.origDims[rect.id].width + 2,
				"left": parseInt(rect.style.left) - this.origDims[rect.id].left + 2	
			});
		}
	},

	mouseupOnSelectedRect: function(rect, e) {
		if(this.selectedRect && !this.splittingSegment) {
			this.saveResizing(this.selectedRect);
		}
		this.resizeMode = "none";
	},

	saveToAltoViewer: function() {
		this.altoViewer.updateSegments(this.deletions, this.resizings, this.insertions, this.contentUpdates, this.lineDiv);
	},

	terminate: function() {
		this.altoViewer.lockLineClick = false;
		this.rects.each(function(r) {
			r.stopObserving("click");
			r.stopObserving("mouseout");
			r.stopObserving("mouseover");
			r.stopObserving("mousemove");
			r.stopObserving("mousedown");
			r.stopObserving("mouseup");
			r.remove();
		});
		this.delButton.remove();
		this.img.stopObserving("mousemove");
		this.img.stopObserving("mouseup");
		this.img.remove();
		this.word_container.remove();
		this.cancelButton.stopObserving("click");
		this.saveButton.stopObserving("click");
		this.cancelButton.remove();
		this.saveButton.remove();
		this.container.remove();
		this.shade.remove();
		document.onkeyup = null;
	}
});
