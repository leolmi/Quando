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

        scope.maincontext = scope.$parent.context;

        scope.toggleAlarm = function(p){
          // quando l'allarme sta suonando è disattivabile solo dal controllo generale
          if (scope.item[p+'ed']) return;
          scope.item[p] = !scope.item[p];
          if (!scope.item[p]){
            scope.item[p+'ed']=false;
          }
        }
      }
    }
  }]);
