/**
 * Created by Leo on 01/04/2015.
 */
'use strict';

angular.module('Quando')
  .directive('tempiItem', ['$location', function ($location) {
    return {
      restrict: 'E',
      scope: {item: '=ngModel'},
      templateUrl: 'app/main/item.html',
      link: function (scope, elm, atr) {
        scope.changed = function() {
          scope.$parent.recalc();
        };
      }
    }
  }]);
