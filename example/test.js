


var map_test = {
    bindTag: function(marker) {
        marker.bindTag('雲灣資訊', {
            lineOptions: {
                color: '#f00',
            },
            offset: [80, -80]
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





