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

function preventDefault(e) {
	if (e.preventDefault) e.preventDefault();
	return false;
}

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
						new Effect.Highlight(this.id.replace("_box", ""), { startcolor: '*ffff99',endcolor: '*ffffff' });
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
				this.style.backgroundColor = "*dfd";
				this.style.cursor = "pointer";
				_this.highlightTextLine(textLine);
			});
			textLine.strings.each(function(word) {
				_this.readorder.push(textBlock.id + ":" + textLine.id + ":" + word.id);
				var span = new Element("span", {"id": textBlock.id + ":" + textLine.id + ":" + word.id});
				span.insert(word.content);
/*				if(word.content.length > 3 && word.wc < 0.9 && !word.updated) {
					_this.imageClient.addOverlay(word.hpos, word.vpos, word.width, word.height, "red", false, "", null);
					span.style.color = "red";
				} else*/ 
				if(word.updated)
					span.style.color = "green";
					
				lineDiv.insert(span);
				lineDiv.insert("&nbsp;"); 
				span.observe("click", function(e) {
					_this.editWord(this);
				});
				span.observe("mouseover", function(e) {
					this.style.backgroundColor = "*ddf";
					this.style.cursor = "pointer";
					_this.highlightWord(word);
				});
				span.observe("mouseout", function(e) {
					this.style.backgroundColor = "transparent";
				});
			});
			lineDiv.observe("click", function(e) {
				_this.zoomToLineAt(textLine, textBlock, _this.scrolledLinePos(this));
				_this.highlightTextLine(textLine);
			});

			lineDiv.observe("mouseout", function(e) { 
				this.style.backgroundColor = "transparent" ;
			});
			textDiv.insert(lineDiv);
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
		var newZoom = 1.0 - ((textLine.width + 40)  / this.alto.page_width);

		if(newZoom < 0.5)
			newZoom = 0.5;
		if(newZoom * textLine.width > parseInt(this.imageContainer.style.width)) {
			newZoom *= parseInt(this.imageContainer.style.width) / (newZoom * textLine.width);
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

	saveCurrentUpdate: function() {
		if(this.current_edit) {
			if(this.current_edit.input.value == "")
				this.current_edit.value = " ";
			this.current_edit.input.stopObserving("keypress");
			var span = $(this.current_edit.input.name);
			if(this.current_edit.input.value != span.innerHTML) {
				this.updates[this.current_edit.input.name] = this.current_edit.input.value;
				$('update_form').insert(new Element("input", {
					"name": "update[" + this.current_edit.input.name + "]",
					"value": this.current_edit.input.value,
					"type": "hidden"
				}));
				span.style.color = "green";
			}
			span.innerHTML = this.current_edit.input.value;
			span.show();
			this.current_edit.input.remove();
			this.current_edit = null;
		}
		return true;
	},

	editWord: function(elem) {
		if(this.saveCurrentUpdate()) {
			var input = new Element("input", {"type": "text", "value": elem.innerHTML, "name": elem.id, "style": "width: " + (10*elem.innerHTML.length) + "px; color: " + elem.style.color, "id": elem.id + "_input"});
			this.highlightWord(this.findWord(elem.id), "*2A2");
			this.current_edit = {"input": input}
			elem.hide();
			elem.insert({after: input});
			
			var _this = this;
			input.observe("keydown", function(e) {
				var k = e.keyCode || e.which;

				if(k == 9) {
					_this.saveCurrentUpdate();
					if(e.shiftKey == 1) _this.editPrevious(this.name);
					else _this.editNext(this.name);
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
						_this.editPrevious(this.name);
						return preventDefault(e);
					} else if(caretPos == this.value.length && k == 39) {
						_this.editNext(this.name);
						return preventDefault(e);
					}
				}
			});
			window.setTimeout("$('" + elem.id + "_input').focus()", 50);
		}
	},

	editPrevious: function(word_id) {
		var i = 0;
		for(i = 0; i < this.readorder.length; ++i)
			if(this.readorder[i] == word_id)
				break;
		if(this.readorder[i-1])
			this.editWord($(this.readorder[i-1]));
	},

	editNext: function(word_id) {
		var i = 0;
		for(i = 0; i < this.readorder.length; ++i)
			if(this.readorder[i] == word_id)
				break;
		if(this.readorder[i+1])
			this.editWord($(this.readorder[i+1]));		
	},

	editUpDown: function(div_id, direction) {
		var lineDivIds = $$("*" + this.textContainer.id + " div.altoLineDiv").map(function(d) {
			return d.id
		});
		var curIndex = lineDivIds.indexOf(div_id);
		if(lineDivIds[curIndex + direction]) {
			var editDiv = $(lineDivIds[curIndex + direction]);
			this.editWord(editDiv.childElements()[0]);
		}
	}
});
