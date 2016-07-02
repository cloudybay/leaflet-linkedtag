

(function (window, document, undefined) {


L.LinkedPath = L.Path.extend({
    initialize: function (latlng, xy, options) {
        L.Path.prototype.initialize.call(this, options);

        this._latlng = this._convertLatLng(latlng);
        this._xy = xy;
    },

    options: {
        // how much to simplify the polyline on each zoom level
        // more = better performance and smoother look, less = more accurate
        color: '#000',
        weight: 1,
        smoothFactor: 1.0,
        noClip: false
    },

    projectLatlngs: function () {
        this._originalPoints = [
            this._map.latLngToLayerPoint(this._latlng),
            this._xy
        ];
    },

    getPathString: function () {
        for (var i = 0, len = this._parts.length, str = ''; i < len; i++) {
            str += this._getPathPartStr(this._parts[i]);
        }
        return str;
    },

    getLatLngs: function () {
        // no usefull
        return this._latlng;
    },

    setLatLngs: function (latlng, xy) {
        this._latlng = this._convertLatLng(latlng);
        this._xy = xy;
        return this.redraw();
    },

    addLatLng: function (latlng) {
        // no usefull
        return this;
    },

    spliceLatLngs: function () { // (Number index, Number howMany)
        // no usefull
        return null;
    },

    closestLayerPoint: function (p) {
        // no usefull
        return null;
    },

    getBounds: function () {
        return new L.LatLngBounds(this.getLatLngs());
    },

    _convertLatLng: function (latlng, overwrite) {
        var target = overwrite ? latlng : {};

        if (L.Util.isArray(latlng) && typeof latlng[0] !== 'number') {
            return;
        }
        target = L.latLng(latlng);

        return target;
    },

    _initEvents: function () {
        L.Path.prototype._initEvents.call(this);
    },

    _getPathPartStr: function (points) {
        var round = L.Path.VML;

        for (var j = 0, len2 = points.length, str = '', p; j < len2; j++) {
            p = points[j];
            if (round) {
                p._round();
            }
            str += (j ? 'L' : 'M') + p.x + ' ' + p.y;
        }
        return str;
    },

    _clipPoints: function () {
        var points = this._originalPoints,
            len = points.length,
            i, k, segment;

        if (this.options.noClip) {
            this._parts = [points];
            return;
        }

        this._parts = [];

        var parts = this._parts,
            vp = this._map._pathViewport,
            lu = L.LineUtil;

        for (i = 0, k = 0; i < len - 1; i++) {
            segment = lu.clipSegment(points[i], points[i + 1], vp, i);
            if (!segment) {
                continue;
            }

            parts[k] = parts[k] || [];
            parts[k].push(segment[0]);

            // if segment goes out of screen, or it's the last one, it's the end of the line part
            if ((segment[1] !== points[i + 1]) || (i === len - 2)) {
                parts[k].push(segment[1]);
                k++;
            }
        }
    },

    // simplify each clipped part of the polyline
    _simplifyPoints: function () {
        var parts = this._parts,
            lu = L.LineUtil;

        for (var i = 0, len = parts.length; i < len; i++) {
            parts[i] = lu.simplify(parts[i], this.options.smoothFactor);
        }
    },

    _updatePath: function () {
        if (!this._map) { return; }

        this._clipPoints();
        this._simplifyPoints();

        L.Path.prototype._updatePath.call(this);
    }
});


L.Handler.LinkedTagDrag = L.Handler.extend({
    initialize: function (tag) {
        this._tag = tag;
    },

    addHooks: function () {
        var div = this._tag._container;
        if (!this._draggable) {
            this._draggable = new L.Draggable(div, div);
        }

        this._draggable
            .on('dragstart', this._onDragStart, this)
            .on('drag', this._onDrag, this)
            .on('dragend', this._onDragEnd, this);
        this._draggable.enable();
        L.DomUtil.addClass(div, 'leaflet-marker-draggable');
    },

    removeHooks: function () {
        this._draggable
            .off('dragstart', this._onDragStart, this)
            .off('drag', this._onDrag, this)
            .off('dragend', this._onDragEnd, this);

        this._draggable.disable();
        L.DomUtil.removeClass(this._tag._container, 'leaflet-marker-draggable');
    },

    moved: function () {
        return this._draggable && this._draggable._moved;
    },

    _onDragStart: function () {
        this._tag
            .fire('movestart')
            .fire('dragstart');
    },

    _onDrag: function () {
        var tag = this._tag,
            divPos = L.DomUtil.getPosition(tag._container),
            offset = tag.getOffset();

        tag.resetPosition(divPos);

        tag
            .fire('move', {pos: divPos})
            .fire('drag');
    },

    _onDragEnd: function (e) {
        this._tag
            .fire('moveend')
            .fire('dragend', e);
    }
});


L.LinkedTag = L.Class.extend({

    includes: L.Mixin.Events,

    options: {
        className: '',
        clickable: false,
        draggable: true,
        noHide: true,
        zoomAnimation: true,
        offset: [48, -48],
        'color': '#777',
        'fillColor': '#fffff9',
        'font': '16px Verdana',
        'padding': '2px 4px',
        'border-width': '2px',
        'border-color': '#777',
        lineOptions: null
    },

    initialize: function (options, source) {
        L.setOptions(this, options);

        this._source = source;
        this._animated = L.Browser.any3d && this.options.zoomAnimation;
        this._isOpen = false;
    },

    onAdd: function (map) {
        this._map = map;

        this._pane = map._panes.markerPane;

        if (!this._container) {
            this._initLayout();
        }

        this._pane.appendChild(this._container);

        this._initInteraction();
        this._update();


        map
            .on('moveend', this._onMoveEnd, this)
            .on('viewreset', this._onViewReset, this);

        if (this._animated) {
            map.on('zoomanim', this._zoomAnimation, this);
            map.on('zoomend', this._endZoomAnimation, this);
        }

        if (L.Browser.touch && !this.options.noHide) {
            L.DomEvent.on(this._container, 'click', this.close, this);
        }

        map.addLayer(this._line);
    },

    onRemove: function (map) {
        map.removeLayer(this._line);

        this._pane.removeChild(this._container);

        map.off({
            zoomanim: this._zoomAnimation,
            moveend: this._onMoveEnd,
            viewreset: this._onViewReset
        }, this);

        this._removeInteraction();

        this._map = null;
    },

    setLatLng: function (latlng) {
        this._latlng = L.latLng(latlng);
        if (this._map) {
            this._updatePosition();
        }
        return this;
    },

    setContent: function (content) {
        // Backup previous content and store new content
        this._previousContent = this._content;
        this._content = content;

        this._updateContent();

        return this;
    },

    close: function () {
        var map = this._map;

        if (map) {
            if (L.Browser.touch && !this.options.noHide) {
                L.DomEvent.off(this._container, 'click', this.close);
            }

            map.removeLayer(this);
        }
    },

    updateZIndex: function (zIndex) {
        this._zIndex = zIndex;

        if (this._container && this._zIndex) {
            this._container.style.zIndex = zIndex;
        }
    },

    setOpacity: function (opacity) {
        this.options.opacity = opacity;

        if (this._container) {
            L.DomUtil.setOpacity(this._container, opacity);
        }
    },

    _initLayout: function () {
        this._container = L.DomUtil.create('div', 'leaflet-linkedtag ' + this.options.className + ' leaflet-zoom-animated');
        this.updateZIndex(this._zIndex);
    },

    _update: function () {
        if (!this._map) { return; }

        this._container.style.visibility = 'hidden';

        this._updateContent();
        this._updatePosition();

        this._container.style.visibility = '';
    },

    _updateContent: function () {
        if (!this._content || !this._map || this._prevContent === this._content) {
            return;
        }

        function _parse_str_to_int(txt) {
            if (txt.length > 2) {
                if (txt.charAt(txt.length-2) == 'p') {
                    txt = txt.substr(0, txt.length-2);
                }
            }
            try {
                return parseInt(txt, 10);
            }
            catch(e) {}
            return 0;
        };

        if (typeof this._content === 'string') {
            var ctx = null;

            if (this._content_canvas) {
                ctx = this._content_canvas.getContext("2d");
                ctx.clearRect(0, 0, this._content_canvas.width, this._content_canvas.height);
            }
            else {
                this._content_canvas = L.DomUtil.create('canvas', '');
                this._container.appendChild(this._content_canvas);
                ctx = this._content_canvas.getContext("2d");
            }

            if (this.options.font) {
                ctx.font = this.options.font;
            }
            var txtWidth = ctx.measureText(this._content).width;
            var txtHeight = 24;
            try {
                var _font_size = ctx.font.split(' ')[0];
                txtHeight = _parse_str_to_int(_font_size);
            }
            catch(e) {}

            var _padding_left = 0, _padding_top = 0;
            if (this.options.padding) {
                var _type = typeof(this.options.padding);
                if (_type == 'string') {
                    var _txts = this.options.padding.split(' ');
                    if (_txts.length > 0) {
                        _padding_top = _parse_str_to_int(_txts[0]);
                        if (_txts.length > 1) {
                            _padding_left = _parse_str_to_int(_txts[1]);
                        }
                        else {
                            _padding_left = _padding_top;
                        }
                    }
                }
                else if (_type == 'number') {
                    _padding_left = this.options.padding;
                    _padding_top = this.options.padding;
                }
            }

            var _border = 0;
            if (this.options['border-width']) {
                var _type = typeof(this.options['border-width']);
                if (_type == 'string') {
                    _border = _parse_str_to_int(this.options['border-width']);
                }
                else if (_type == 'number') {
                    _border = this.options['border-width'];
                }
                _padding_left += _border;
                _padding_top += _border;
            }

            if (_padding_left > 0) {
                txtWidth += (_padding_left * 2);
            }
            if (_padding_top > 0) {
                txtHeight += (_padding_top * 2);
            }
            this._content_canvas.width = txtWidth;
            this._content_canvas.height = txtHeight;

            if (this.options.fillColor) {
                ctx.fillStyle = this.options.fillColor;
            }
            ctx.fillRect(0, 0, txtWidth, txtHeight);

            if (_border) {
                ctx.lineWidth = _border;
                if (this.options['border-color']) {
                    ctx.strokeStyle = this.options['border-color'];
                }
                ctx.strokeRect(0+(_border/2), 0+(_border/2), txtWidth-_border, txtHeight-_border);
            }

            if (this.options.color) {
                ctx.fillStyle = this.options.color;
            }
            if (this.options.font) {
                ctx.font = this.options.font;
            }
            ctx.fillText(this._content, _padding_left, txtHeight - _padding_top - 3);
        }
    },

    _updatePosition: function () {
        var pos = this._map.latLngToLayerPoint(this._latlng);

        this._setPosition(pos);
    },

    _setPosition: function (pos) {
        var map = this._map,
            container = this._container,
            centerPoint = map.latLngToContainerPoint(map.getCenter()),
            tagPoint = map.layerPointToContainerPoint(pos),
            tagWidth = this._tagWidth;

        if (!this._offset) {
            this._offset = L.point(this.options.offset);
        }

        var offx = parseInt(this._container.clientWidth / 2.0 + 0.5),
            offy = parseInt(this._container.clientHeight / 2.0 + 0.5);

        this._pos = pos.add(this._offset);

        this._setLinePosition(this._pos);

        var _pos = this._pos.subtract(L.point(offx, offy));
        L.DomUtil.setPosition(container, _pos);
    },

    resetPosition: function(pos) {
        var offx = parseInt(this._container.clientWidth / 2.0 + 0.5),
            offy = parseInt(this._container.clientHeight / 2.0 + 0.5);

        var marker_pos = this._map.latLngToLayerPoint(this._latlng);

        this._pos = pos.add(L.point(offx, offy));
        this._offset = this._pos.subtract(marker_pos);
        this._setLinePosition(this._pos);
    },

    _setLinePosition: function(pos) {
        if (!this._line) {
            this._line = new L.LinkedPath(this._latlng, pos);
            if (this.options.lineOptions) {
                this._line.setStyle(this.options.lineOptions);
            }
        }
        else {
            this._line.setLatLngs(this._latlng, pos);
        }
    },

    getOffset: function() {
        return this._offset;
    },

    _zoomAnimation: function (opt) {
        if (this._line && this._map) {
            this._map.removeLayer(this._line);
        }

        var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();

        this._setPosition(pos);
    },

    _endZoomAnimation: function (opt) {
        if (this._line && this._map) {
            this._map.addLayer(this._line);
        }
    },

    _onMoveEnd: function () {
        if (!this._animated) {
            this._updatePosition();
        }
    },

    _onViewReset: function (e) {
        /* if map resets hard, we must update the tag */
        if (e && e.hard) {
            this._update();
        }
    },

    _initInteraction: function () {
        var container = this._container,
            events = ['dblclick', 'mousedown', 'mouseover', 'mouseout', 'contextmenu'];

        L.DomUtil.addClass(container, 'leaflet-clickable');
        L.DomEvent.on(container, 'click', this._onMouseClick, this);

        for (var i = 0; i < events.length; i++) {
            L.DomEvent.on(container, events[i], this._fireMouseEvent, this);
        }

        if (L.Handler.LinkedTagDrag) {
            this.dragging = new L.Handler.LinkedTagDrag(this);

            if (this.options.draggable) {
                this.dragging.enable();
            }
        }
    },

    _removeInteraction: function () {
        var container = this._container,
            events = ['dblclick', 'mousedown', 'mouseover', 'mouseout', 'contextmenu'];

        L.DomUtil.removeClass(container, 'leaflet-clickable');
        L.DomEvent.off(container, 'click', this._onMouseClick, this);

        for (var i = 0; i < events.length; i++) {
            L.DomEvent.off(container, events[i], this._fireMouseEvent, this);
        }

        if (this.dragging) {
            this.dragging.disable();
        }
    },

    _onMouseClick: function (e) {
        var wasDragged = this.dragging && this.dragging.moved();

        if (this.hasEventListeners(e.type)) {
            L.DomEvent.stopPropagation(e);
        }

        if (wasDragged) { return; }

        if ((!this.dragging || !this.dragging._enabled) && this._map.dragging && this._map.dragging.moved()) { return; }

        this.fire(e.type, {
            originalEvent: e,
            offset: this._offset
        });
    },

    _fireMouseEvent: function (e) {
        this.fire(e.type, {
            originalEvent: e
        });

        // TODO proper custom event propagation
        // this line will always be called if marker is in a FeatureGroup
        if (e.type === 'contextmenu' && this.hasEventListeners(e.type)) {
            L.DomEvent.preventDefault(e);
        }
        if (e.type !== 'mousedown') {
            L.DomEvent.stopPropagation(e);
        } else {
            L.DomEvent.preventDefault(e);
        }
    }
});


L.MarkerLinkedTag = {
    showTag: function () {
        this.options.tagVisible = true;
        if (this.tag && this._map) {
            this.tag.setLatLng(this._latlng);
            this._map.showTag(this.tag);
        }

        return this;
    },

    hideTag: function () {
        this.options.tagVisible = false;
        if (this.tag) {
            this.tag.close();
        }
        return this;
    },

    isTagVisible: function() {
        return this.options.tagVisible;
    },

    setTagNoHide: function (noHide) {
        if (this.options.tagNoHide === noHide) {
            return;
        }

        this._tagNoHide = noHide;

        if (noHide) {
            this._removeTagRevealHandlers();
            this.showTag();
        } else {
            this._addTagRevealHandlers();
            this.hideTag();
        }
    },

    bindTag: function (content, options) {
        options = L.Util.extend({noHide: true}, options);

        this._tagNoHide = options.noHide;

        if (!this.tag) {
            if (!this._tagNoHide) {
                this._addTagRevealHandlers();
            }

            this
                .on('remove', this._onMarkerRemove, this)
                .on('move', this._moveTag, this)
                .on('add', this._onMarkerAdd, this);

            this._hasTagHandlers = true;
        }
        else {
            this.unbindTag();
        }
        this.tag = new L.LinkedTag(options, this)
            .setContent(content);

        return this;
    },

    unbindTag: function () {
        if (this.tag) {
            this.hideTag();

            this.tag = null;

            if (this._hasTagHandlers) {
                if (!this._tagNoHide) {
                    this._removeTagRevealHandlers();
                }

                this
                    .off('remove', this._onMarkerRemove, this)
                    .off('move', this._moveTag, this)
                    .off('add', this._onMarkerAdd, this);
            }

            this._hasTagHandlers = false;
        }
        return this;
    },

    updateTagContent: function (content) {
        if (this.tag) {
            this.tag.setContent(content);
        }
    },

    getTag: function () {
        return this.tag;
    },

    _onMarkerAdd: function () {
        if (this.options.tagVisible) {
            if (this.tag && this._map) {
                this.tag.setLatLng(this._latlng);
                this._map.showTag(this.tag);
            }
        }
    },

    _onMarkerRemove: function () {
        if (this.tag) {
            this.tag.close();
        }
    },

    _addTagRevealHandlers: function () {
        this
            .on('mouseover', this.showTag, this)
            .on('mouseout', this.hideTag, this);

        if (L.Browser.touch) {
            this.on('click', this.showTag, this);
        }
    },

    _removeTagRevealHandlers: function () {
        this
            .off('mouseover', this.showTag, this)
            .off('mouseout', this.hideTag, this);

        if (L.Browser.touch) {
            this.off('click', this.showTag, this);
        }
    },

    _moveTag: function (e) {
        this.tag.setLatLng(e.latlng);
    }
};

L.Marker.include(L.MarkerLinkedTag);


L.Map.include({
    showTag: function (tag) {
        return this.addLayer(tag);
    }
});


}(this, document));
