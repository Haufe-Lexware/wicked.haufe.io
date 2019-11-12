/* global $, jsGrid, localInit */
/* eslint-disable no-var */

function isEmptyGridFilter(filter) {
    var isEmpty = true;
    $.each(filter, function () {
        $.each(this, function (prop, value) {
            if (value != "") {
                isEmpty = false;
                return false;
            }
        });
    });
    return isEmpty;
}

function applyGridFilter(filter, item) {
    if (!filter || !item)
        return false;
    for (var prop in filter) {
        if (typeof filter[prop] === "object") { //look for nested
            if (applyGridFilter(filter[prop], item[prop]))
                return true;
            continue;
        }
        var regexp = new RegExp(filter[prop], 'gi');
        if (filter[prop] && filter[prop].length > 0) {
            if (item[prop] && item[prop].match(regexp))
                return true;
        }
    }
    return false;
}

function setMouseOverElementContent($elem, content) {
  $elem.attr({
    "data-toggle": "popover",
    "data-placement": "right",
    "data-content": content
  }).popover({trigger: "manual", animation: false});
  $elem.on("mouseenter", function () {
      var _this = this;
      $(this).popover("show");
      $(".popover").on("mouseleave", function () {
          $(_this).popover('hide');
      });
  }).on("mouseleave", function () {
      var _this = this;
      setTimeout(function () {
          if (!$(".popover:hover").length) {
              $(_this).popover("hide");
          }
      }, 300);
  });
}

function dateFormat (date, fstr, utc) {
    utc = utc ? 'getUTC' : 'get';
    return fstr.replace (/%[YmdHMS]/g, function (m) {
      switch (m) {
      case '%Y': return date[utc + 'FullYear'] ();
      case '%m': m = 1 + date[utc + 'Month'] (); break;
      case '%d': m = date[utc + 'Date'] (); break;
      case '%H': m = date[utc + 'Hours'] (); break;
      case '%M': m = date[utc + 'Minutes'] (); break;
      case '%S': m = date[utc + 'Seconds'] (); break;
      default: return m.slice (1);
      }
      return ('0' + m).slice (-2);
    });
}

$(document).ready(function () {
    jsGrid.loadStrategies.DirectLoadingStrategy.prototype.finishDelete = function (deletedItem, deletedItemIndex) {
        var grid = this._grid;
        grid.option("data").splice(deletedItemIndex, 1);
        grid.refresh();
    };
    jsGrid.Grid.prototype._sortData = function () { //compensate sorting bug for nested data
        var self = this,
            sortFactor = this._sortFactor(),
            sortField = this._sortField;
        if (sortField) {
            this.data.sort(function (item1, item2) {
                var value1 = self._getItemFieldValue(item1, sortField);
                var value2 = self._getItemFieldValue(item2, sortField);
                return sortFactor * sortField.sortingFunc(value1, value2);
            });
        }
    };

    if (window.localInit) {
        localInit();
    }
});