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

function getStateFromHistory() {
    return {
        filter: JSON.parse(history.state.filter),
        sorting: JSON.parse(history.state.sorting),
        pageIndex: history.state.pageIndex
    };
}

function getStateFromGrid(grid) {
    return {
        filter: JSON.stringify(grid.getFilter()),
        sorting: JSON.stringify(grid._sortingParams()),
        pageIndex: grid.pageIndex
    };
}

function getFilterValueFromState(filter, fieldName) {
    let fieldNameNestedPops = fieldName.split(".");
    for (let prop in filter) {
        if (prop === fieldNameNestedPops[0]) {
            if (typeof filter[prop] === "object" && fieldNameNestedPops.length > 1) //look for nested
                return getFilterValueFromState(filter[prop], fieldNameNestedPops.slice(-1)[0]);
            if (prop === fieldName)
                return filter[prop];
        }
    }
    return "";
}

function setFilter(grid, filter) {
    for (let prop in grid.fields) {
        let filterValue = getFilterValueFromState(filter, (grid.fields)[prop].name);
        $((grid.fields)[prop].filterControl).val(filterValue);
    }
    if (!isEmptyGridFilter(filter))
        grid.filtering = true;
}

function setSorting(grid, sortingParams) {
    grid._clearSortingCss();
    grid._sortField = ($.isEmptyObject(sortingParams)) ? "" : setSortingField(grid, sortingParams);
    grid._sortOrder = ($.isEmptyObject(sortingParams)) ? "" : sortingParams.sortOrder;
    grid._setSortingCss();
}

function setSortingField(grid, state) {
    return grid.fields.filter((elem) => (elem.name === state.sortField) ? true : false)[0];
}

function initializeGridFromStateServerSide(grid) {
    let gridSettings = getStateFromHistory();
    grid.isGridRefreshAvailable = false;
    return new Promise((resolve, reject) => {
        setFilter(grid, gridSettings.filter);
        setSorting(grid, gridSettings.sorting);
        grid.pageIndex = gridSettings.pageIndex;
        grid.loadData();
        resolve();
    });
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

function dateFormat(date, fstr, utc) {
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

function setHistoryToState(grid) {
    var params = getStateFromGrid(grid);
    if (JSON.stringify(history.state) !== JSON.stringify(params) && grid.isGridRefreshAvailable) {
        history.pushState(params, `title ${grid.pageIndex}`, `?page=${grid.pageIndex}`);
    }
}

$(document).ready(function () {
    jsGrid.Grid.prototype.onRefreshed = function (args) {
        if (!args.grid.pageLoading)
            setHistoryToState(args.grid);
    };
    jsGrid.Grid.prototype.onOptionChanged = function (args) {
        if (args.grid.pageLoading)
            setHistoryToState(args.grid);
    };
    jsGrid.Grid.prototype.onDataLoading = function (args) {
        if (!!history.state && !args.grid.isInitialLoaded && args.grid.pageLoading) {
            var gridSettings = getStateFromHistory();
            args.grid.pageIndex = gridSettings.pageIndex;
            setFilter(args.grid, gridSettings.filter);
            setSorting(args.grid, gridSettings.sorting);
            $.extend(args.filter, gridSettings.filter, gridSettings.sorting, { pageIndex: gridSettings.pageIndex });
        }
        if (isEmptyGridFilter(args.grid.getFilter()))
            args.grid.filtering = false;
        args.grid.isInitialLoaded = true;

    };
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