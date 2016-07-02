


var map_test = {
    bindTag: function(marker) {
        marker.bindTag('Linked Tag', {
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





