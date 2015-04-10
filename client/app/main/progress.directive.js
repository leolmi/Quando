/**
 * Created by Leo on 10/04/2015.
 */
'use strict';

angular.module('Quando')
  .directive('progressClock', [function () {
    function validate(v, min, max){
      v = Math.max(min, v);
      v = Math.min(v, max);
      return v;
    }

    return {
      restrict: 'E',
      scope: {options: '=ngModel'},
      templateUrl: 'app/main/progress.html',
      link: function (scope, elm, atr) {
        scope.options = scope.options || {};
        scope.options.backcolor = scope.options.backcolor || '#222';
        scope.options.forecolor = scope.options.forecolor || '#fff';

        var diameter = validate(scope.options.diameter, 16, 2000);
        var radius = validate(scope.options.diameter/2, 8, 1000);
        var border = validate(scope.options.border, 0, 500);

        scope.topstyle ={
          'z-index': '10',
          'left': '0',
          'top': '0',
          'width': radius+'px',
          'height': diameter+'px',
          'border-top-left-radius': radius+'px',
          'border-bottom-left-radius': radius+'px',
          'background-color':scope.options.forecolor
        };
        scope.fixedstyle ={
          'z-index': '4',
          'left': radius+'px',
          'top': '1px',
          'width': (radius-1)+'px',
          'height': (diameter-2)+'px',
          'border-top-right-radius': radius+'px',
          'border-bottom-right-radius': radius+'px',
          'background-color':scope.options.backcolor
        };
        scope.basestyle ={
          'margin-top': '-'+border+'px',
          'margin-left': '-'+border+'px',
          'z-index': '2',
          'left': '0',
          'top': '0',
          'width': (diameter+2*border)+'px',
          'height': (diameter+2*border)+'px',
          'border-radius': (radius+border)+'px',
          'background-color':scope.options.forecolor
        };




        function refresh() {
          var v = scope.options.value;
          v = Math.max(0,v);
          v = Math.min(v,100);
          var dg = Math.floor((v * 360) / 100);
          scope.rotatorstyle = {
            'z-index': '8',
            'left': '1px',
            'top': '1px',
            'width': (radius-1)+'px',
            'height': (diameter-2)+'px',
            'border-top-left-radius': radius+'px',
            'border-bottom-left-radius': radius+'px',
            'background-color':scope.options.backcolor,
            'transform-origin':'100% 50%',
            'transform': 'rotate(' + dg + 'deg)',
            '-webkit-transform': 'rotate(' + dg + 'deg)',
            '-moz-transform': 'rotate(' + dg + 'deg)',
            '-o-transform': 'rotate(' + dg + 'deg)',
            '-ms-transform': 'rotate(' + dg + 'deg)'
          };
          scope.after50 = dg>180;
        }

        if (scope.options) {
          scope.$watch('options.value', function () {
            refresh();
          });
        }
      }
    }
  }]);
