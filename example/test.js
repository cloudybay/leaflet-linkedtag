


var map_test = {
    bindTag: function(marker) {
        marker.bindTag('測2016 81:00', {
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





