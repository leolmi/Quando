/**
 * Created by Leo on 06/02/2015.
 */
'use strict';

angular.module('Quando')
  .factory('Logger', function(toastr){
    function getToastrSettings(){
      return {
        allowHtml: true,
        closeButton: false,
        closeHtml: '<button>&times;</button>',
        containerId: 'toast-container',
        extendedTimeOut: 1000,
        iconClasses: {
          error: 'toast-error',
          info: 'toast-info',
          success: 'toast-success',
          warning: 'toast-warning'
        },
        messageClass: 'toast-message',
        positionClass: 'toast-bottom-right',
        tapToDismiss: true,
        timeOut: 5000,
        titleClass: 'toast-title',
        toastClass: 'toast'
      }
    }

    var toastOk = function(title, message){
      if (typeof message!='string')
        message = JSON.stringify(message);
      toastr.success(message, title, getToastrSettings());
    };

    var toastError = function(title, message){
      if (typeof message!='string')
        message = JSON.stringify(message);
      toastr.error(message, title, getToastrSettings());
    };

    var toastInfo = function(title, message){
      if (typeof message!='string')
        message = JSON.stringify(message);
      toastr.info(message, title, getToastrSettings());
    };

    var toastWarning = function(title, message){
      if (typeof message!='string')
        message = JSON.stringify(message);
      toastr.warning(message, title, getToastrSettings());
    };

    return {
      ok: toastOk,
      error: toastError,
      info: toastInfo,
      warning: toastWarning
    }
  });
