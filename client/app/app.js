'use strict';

angular.module('Quando', [
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'ngRoute',
  'ui.bootstrap',
  'toastr'
])
  .config(function ($routeProvider, $locationProvider, $compileProvider) {
    $routeProvider
      .otherwise({
        redirectTo: '/'
      });
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|file|blob):/);
    $locationProvider.html5Mode(true);
  });
