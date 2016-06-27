


var map_test = {
    bindTag: function(marker) {
        marker.bindTag('TEST', {
            'background': '#fffffa',
            'border-color': '#555',
            'border-radius': '4px',
            'border-style': 'solid',
            'border-width': '2px',
            'color': '#111',
            'opacity': 0.9,
            lineOptions: {
                color: '#f00'
            }
        });
        marker.showTag();

        marker.on('click', function(e) {
            if (this.isTagVisible())
                this.hideTag();
            else
                this.showTag();
        });
    }
};





