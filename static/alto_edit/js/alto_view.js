/*
* alto_view.js: Viewer and editor for ALTO represented as JSON
* For details see: http://opendatachallenge.kbresearch.nl/
* Copyright (C) 2011 R. van der Ark, Koninklijke Bibliotheek - National Library of the Netherlands
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

var AltoView = Class.create({
	initialize: function(alto, image_client, text_container, words, zc) {
		this.alto = alto;
		this.words = (words ? words.toLowerCase().split(" ") : []);
		this.imageClient = image_client;
		this.imageContainer = this.imageClient.container;
		this.textContainer = $(text_container);
		this.lineHighlight = null;
		this.blockAreas = [];
		this.updates = [];
		this.readorder = [];
		this.current_edit = null;
		this.lockLineClick = false;
		this.broadestLine = 0;
		this.renderText();
	},

	renderText: function() {
		var _this = this;
		this.alto.blocks.each(function(textBlock) {
			_this.renderTextBlock(textBlock);
			_this.blockAreas.push(_this.imageClient.addOverlay(
					textBlock.hpos, 
					textBlock.vpos, 
					textBlock.width, 
					textBlock.height, 
					"red", 
					true,
					textBlock.id + "_box", 
					function(e) { 
						_this.textContainer.scrollTop = $(this.id.replace("_box", "")).offsetTop - (Prototype.Browser.IE ? 0 : _this.textContainer.offsetTop);
						new Effect.Highlight(this.id.replace("_box", ""), { startcolor: '#ffff99',endcolor: '#ffffff' });
						_this.imageClient.setPosition(textBlock.hpos * _this.imageClient.getZoom(), (textBlock.vpos * _this.imageClient.getZoom()));
						_this.imageClient.render();
					}
			));
		});
	},

	renderTextBlock: function(textBlock) {
		var _this = this;
		var textDiv = new Element("div", {"id": textBlock.id});
		textBlock.lines.each(function(textLine) {
			var lineDiv = new Element("div", {"id": textLine.id, "class": "altoLineDiv"});
			lineDiv.observe("mouseover", function(e) {
				this.style.backgroundColor = "#dfd";
				this.style.cursor = "pointer";
				_this.highlightTextLine(textLine);
			});
			lineDiv.observe("mousemove", function(e) {
				$$('.seg_corrector').each(Element.hide);
				if(e.clientX > (this.cumulativeOffset()[0] + this.getWidth() - 40))
					$(this.id + ":corrector1").show();	
			});
			_this.appendSegLink(lineDiv);
			textLine.strings.each(function(word) {
				if(!word["delete"]) {
					_this.readorder.push(textBlock.id + ":" + textLine.id + ":" + word.id);
					var span = new Element("span", {"id": textBlock.id + ":" + textLine.id + ":" + word.id});
					span.insert(word.content);
					if(word.updated)
						span.style.color = "green";
					
					lineDiv.insert(span);
					lineDiv.insert("&nbsp;"); 
					span.observe("click", function(e) {
						_this.editWord(this);
					});
					span.observe("mouseover", function(e) {
						this.style.backgroundColor = "#ddf";
						this.style.cursor = "pointer";
						_this.highlightWord(word);
					});
					span.observe("mouseout", function(e) {
						this.style.backgroundColor = "transparent";
					});
				}
			});
			lineDiv.observe("click", function(e) {
				_this.zoomToLineAt(textLine, textBlock, _this.scrolledLinePos(this));
				_this.highlightTextLine(textLine);
				if(!this.childElements().detect(function(e) { return e.id.match(/_input$/); }) && !_this.lockLineClick)
					_this.editWord(this.childElements()[0]);
			});

			lineDiv.observe("mouseout", function(e) { 
				this.style.backgroundColor = "transparent";
			});
			_this.broadestLine = _this.broadestLine > textLine.width ? _this.broadestLine : textLine.width;
			textDiv.insert(lineDiv);
			if(!_this.validateSegments(lineDiv)) 
				_this.appendCorrectSegLink(lineDiv);


		});
		this.textContainer.insert(textDiv);
		this.textContainer.insert(new Element("br"));
	},

	findLine: function(lineId) {
		for(i = 0; i < this.alto.blocks.length; ++i) {
			var curLine = this.alto.blocks[i].lines.detect(function(l) { return l.id == lineId; });
			if(curLine) return curLine;
		};
		return null;
	},

	findWord: function(wordId) {
		wordId = wordId.replace(/.*:/, "");
		for(i = 0; i < this.alto.blocks.length; ++i) {
			for(j = 0; j < this.alto.blocks[i].lines.length; ++j) {
				var curWord = this.alto.blocks[i].lines[j].strings.detect(function(w) { return w.id == wordId; });
				if(curWord) return curWord;
			}
		};
		return null;
	},

	scrolledLinePos: function(textDiv) {
		return textDiv.offsetTop - this.scrollPosition();
	},

	scrollPosition: function() {
		return this.textContainer.scrollTop + (Prototype.Browser.IE ? 0 : this.textContainer.offsetTop);
	},

	zoomToLineAt: function(textLine, textBlock, atPosition) {
		var newZoom = 1.0 - ((this.broadestLine + 60)  / this.alto.page_width);

		if(newZoom < 0.5)
			newZoom = 0.5;
		if(newZoom * textLine.width > parseInt(this.imageContainer.style.width) + 60) {
			newZoom *= parseInt(this.imageContainer.style.width) / (newZoom * (this.broadestLine +60));
		}
		this.imageClient.setZoom(newZoom); //1.0 - (textLine.width  / this.alto.page_width));
		this.imageClient.setPosition((textLine.hpos * this.imageClient.getZoom())-20, (textLine.vpos * this.imageClient.getZoom()) - atPosition);
		this.imageClient.render();
	},

	highlightTextLine: function(textLine) {
		if(this.lineHighlight) this.imageClient.dropOverlay(this.lineHighlight);
		this.lineHighlight = this.imageClient.addOverlay(textLine.hpos, textLine.vpos, textLine.width, textLine.height, "blue");
	},

	highlightWord: function(wrd, setColor) {
		if(this.wordHighlight) this.imageClient.dropOverlay(this.wordHighlight);
		this.wordHighlight = this.imageClient.addOverlay(wrd.hpos, wrd.vpos, wrd.width, wrd.height, (setColor ? setColor : "blue"));
	},

	appendCorrectSegLink: function(lineDiv) {
		var correctLink = new Element("a", {
			"style": "color: red; font-weight: bold; margin-right: 40px; text-decoration: underline",
			"id": lineDiv.id + ":corrector"
		});

		correctLink.insert("!!!");
		lineDiv.insert(correctLink);
		var _this = this;
		correctLink.observe("click", function(e) {
			_this.saveCurrentUpdate();
			_this.lockLineClick = true;
			new SegEdit(_this.findLine(lineDiv.id), _this.imageClient, lineDiv, _this);
		});

	},

	appendSegLink: function(lineDiv) {
		var correctLink = new Element("a", {
			"style": "float: right; color: blue; font-weight: bold; margin-right: 3px; text-decoration: underline",
			"class": "seg_corrector",
			"id": lineDiv.id + ":corrector1"
		});

		correctLink.insert("...");
		lineDiv.insert(correctLink);
		var _this = this;
		correctLink.observe("click", function(e) {
			_this.saveCurrentUpdate();
			_this.lockLineClick = true;
			new SegEdit(_this.findLine(lineDiv.id), _this.imageClient, lineDiv, _this);
		});
		correctLink.hide();
	},

	updateSegments: function(deletions, resizings, insertions, contentUpdates, lineDiv) {
		var _this = this;
		var altoLine = this.findLine(lineDiv.id);

		insertions.each(function(insert) {
			var spans = lineDiv.childElements();
			for(var i = 0; i < spans.length; ++i) {
				var word = _this.findWord(spans[i].id);
				var nextWord = (i == spans.length - 1 ? null : _this.findWord(spans[i+1].id))
				if((word && nextWord && word.hpos < insert.hpos && nextWord.hpos > insert.hpos) || (word && !nextWord && word.hpos < insert.hpos)) {
					var newSpan = new Element("span", {"id": lineDiv.ancestors()[0].id + ":" + lineDiv.id + ":" + insert.id, "style": "color: green"});
					newSpan.insert(insert.content);
					spans[i].insert({after: newSpan});
					newSpan.insert({before: "&nbsp;"});
					altoLine.strings.splice(i,0, insert);
					_this.readorder.splice(_this.readorder.indexOf(spans[i].id)+1, 0, newSpan.id);
          newSpan.observe("click", function(e) {
            _this.editWord(this);
          });

          newSpan.observe("mouseover", function(e) {
            this.style.backgroundColor = "#ddf";
            this.style.cursor = "pointer";
            _this.highlightWord(insert);
          });

          newSpan.observe("mouseout", function(e) {
            this.style.backgroundColor = "transparent";
          });

					_this.insertUpdateField("insert", newSpan.id, "after", spans[i].id);
					_this.insertUpdateField("insert", newSpan.id, "width", insert.width);
					_this.insertUpdateField("insert", newSpan.id, "hpos", insert.hpos);
					_this.insertUpdateField("insert", newSpan.id, "vpos", insert.vpos);
					_this.insertUpdateField("insert", newSpan.id, "height", insert.height);
					_this.insertUpdateField("insert", newSpan.id, "content", insert.content);
					break;	
				} 
			}
		});

		contentUpdates.each(function(cu) {
			$(lineDiv.ancestors()[0].id + ":" + lineDiv.id + ":" + cu.id).innerHTML = cu.content;
			_this.insertUpdateField("update", lineDiv.ancestors()[0].id + ":" + lineDiv.id + ":" + cu.id, "content", cu.content);
		});

		resizings.each(function(resize) {
			var word = _this.findWord(resize.id);
			if(word) {
				word.hpos += resize.left;
				word.width += resize.width;
				_this.insertUpdateField("update", resize.id, "width", word.width);
				_this.insertUpdateField("update", resize.id, "hpos", word.hpos);
			}
		})		

		deletions.each(function(d) { 
			$(d).remove();
			_this.readorder.remove(_this.readorder.indexOf(d));
			_this.insertUpdateField("update", d, "delete", "true");
		});
		if(this.validateSegments(lineDiv) && $(lineDiv.id + ":corrector"))
			$(lineDiv.id + ":corrector").remove();
	},

	insertUpdateField: function(action, id, key, value) {
		var existing =	$$("#update_form input").detect(function(inp) {
			return inp.getAttribute("name") == action + "[" + id + "][" + key + "]";
		});

		if(existing) {
			existing.value = value;
		} else {
			$('update_form').insert(new Element("input", {
				"name": action + "[" + id + "][" + key + "]",
				"value": value,
				"type": "hidden"
			}));
		}
	},

	validateSegments: function(lineDiv) {
		var spans	= lineDiv.childElements();
		for(var x = 0; x < spans.length; x++) {
			if(spans[x].innerHTML == "&nbsp;" || spans[x].innerHTML == " " || spans[x].innerHTML.match(/[^\s]+\s+[^\s]+/) ) {
				return false;
			}
		}
		return true;
	},

	saveCurrentUpdate: function() {
		if(this.current_edit) {
			var span = $(this.current_edit.input.name);
			var lineDiv = this.current_edit.input.ancestors()[0];
			this.current_edit.input.stopObserving("keypress");
			if(this.current_edit.input.value == "") 
				this.current_edit.input.value = "&nbsp;";
			
			if(this.current_edit.input.value != span.innerHTML) {
				this.updates[this.current_edit.input.name] = this.current_edit.input.value;

				this.insertUpdateField("update", this.current_edit.input.name, "content", this.current_edit.input.value);

				span.style.color = "green";
			}
			span.innerHTML = this.current_edit.input.value;
			span.show();

			if(this.validateSegments(lineDiv)) {
				if($(lineDiv.id + ":corrector"))
					$(lineDiv.id + ":corrector").remove();
			} else if(!$(lineDiv.id + ":corrector"))
				this.appendCorrectSegLink(lineDiv);
			 
			this.current_edit.input.stopObserving("mouseover");
			this.current_edit.input.stopObserving("keydown");
			this.current_edit.input.remove();
			this.current_edit = null;
		}
		return true;
	},

	editWord: function(elem) {
		if(this.saveCurrentUpdate()) {
			var input = new Element("input", {"type": "text", "value": elem.innerHTML.replace("&nbsp;", ""), "name": elem.id, "style": "width: " + (10*elem.innerHTML.length) + "px; color: " + elem.style.color, "id": elem.id + "_input"});
			this.highlightWord(this.findWord(elem.id), "#2A2");
			this.current_edit = {"input": input}
			elem.hide();
			elem.insert({after: input});
			
			var _this = this;
			input.observe("mouseover", function(e) {
				_this.highlightWord(_this.findWord(this.name));
			});
			input.observe("keydown", function(e) {
				var k = e.keyCode || e.which;
				if(k == 9) {
					_this.saveCurrentUpdate();
					if(e.shiftKey == 1) _this.editPrevNext(this.name, -1);
					else _this.editPrevNext(this.name, 1);
					return preventDefault(e);
				} else if(k == 13) {
					_this.saveCurrentUpdate();
					return preventDefault(e);
				} else if(k == 38) {
					_this.editUpDown(this.ancestors()[0].id, -1);
					return preventDefault(e);
				} else if(k == 40) {
					_this.editUpDown(this.ancestors()[0].id, 1);
					return preventDefault(e);
				} else if(k == 39 || k == 37) {
					var caretPos = null;
					if(document.selection) {
						var r = document.selection.createRange();
						r.moveEnd('character', this.value.length);
						caretPos = this.value.lastIndexOf(r.text);
					} else
						caretPos = this.selectionStart;

					if(caretPos == 0 && k == 37) {
						_this.editPrevNext(this.name, -1);
						return preventDefault(e);
					} else if(caretPos == this.value.length && k == 39) {
						_this.editPrevNext(this.name, 1);
						return preventDefault(e);
					}
				}
			});
			window.setTimeout("$('" + elem.id + "_input').focus(); $('" + elem.id + "_input').select()", 50);
		}
	},

	editPrevNext: function(word_id, direction) {
		var i = 0;
		for(i = 0; i < this.readorder.length; ++i)
			if(this.readorder[i] == word_id)
				break;

		if(this.readorder[i+direction]) {
			this.editWord($(this.readorder[i+direction]));
			var editDiv = $(this.readorder[i+direction]).ancestors()[0];
			if($(word_id).ancestors()[0] != editDiv)
				this.zoomToLineAt(this.findLine(editDiv.id), null, this.scrolledLinePos(editDiv));
		}
	},

	editUpDown: function(div_id, direction) {
		var lineDivIds = $$("#" + this.textContainer.id + " div.altoLineDiv").map(function(d) {
			return d.id
		});

		var curIndex = lineDivIds.indexOf(div_id);
		if(lineDivIds[curIndex + direction]) {
			var editDiv = $(lineDivIds[curIndex + direction]);
			this.editWord(editDiv.childElements()[1]);
			this.zoomToLineAt(this.findLine(editDiv.id), null, this.scrolledLinePos(editDiv));
		}
	}
});
