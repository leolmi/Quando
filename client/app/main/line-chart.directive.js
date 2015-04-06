/**
 * Created by Leo on 06/04/2015.
 */
'use strict';

angular.module('Quando')
  .directive('lineChart', ['$location', function ($location) {
    return {
      restrict: 'E',
      scope: { item: '=ngModel'},
      templateUrl: 'app/main/line-chart.html',
      link: function (scope, elm, atr) {
        scope.zoom = .7;

        scope.getTime = function(m) {
          var hT = Math.floor(m/60);
          var mT = m-(hT*60);
          if (mT.toString().length<2) mT='0'+mT;
          return hT+':'+mT;
        };
      }
    }
  }]);
