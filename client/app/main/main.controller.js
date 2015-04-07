/**
 * Created by Leo on 01/04/2015.
 */
'use strict';

angular.module('Quando')
  .controller('TempiCtrl', ['$scope','$http','$interval', function ($scope,$http,$interval) {
    $scope.context = {
      o:'8',
      exit:'?',
      items: [{
        E:'8:30',
        U:''
      }],
      debug:{}
    };
    /**
     * C0 - numero
     * C1 - data (dd/MM/yyyy)
     * C2 - ora
     * C3 - minuti
     * C4 - tipo (E o U)
     * @type {boolean}
     */
    $scope.milking = false;
    function milkinaz(all) {
      if ($scope.milking) return;
      $scope.milking = true;
      $scope.context.user.all = all;
      $http.post('/api/inaz', $scope.context.user)
        .success(function(data) {
          if (data && data.length){
            if (all) {
              $scope.context.allitems = data;
              $scope.calcAllItems();
            }
            else {
              var items = [];
              var i = {};
              data.forEach(function (r) {
                if (r['C4'] == 'E') {
                  if (i.E) {
                    items.push(i);
                    i = {};
                  }
                  i.E = r['C2'] + ':' + r['C3'];
                }
                else if (r['C4'] == 'U') {
                  if (i.U) {
                    items.push(i);
                    i = {};
                  }
                  i.U = r['C2'] + ':' + r['C3'];
                }
              });
              if (i.E || i.U)
                items.push(i);
              $scope.context.items = items;
              $scope.recalc();
            }
          }
        })
        .error(function(err){
          alert('ERRORE: '+JSON.stringify(err));
        })
        .then(function() {
          $scope.milking = false;
        });
    }

    var automilk;
    $scope.start = function() {
      $scope.stop();
      automilk = $interval(milkinaz, 30000);
    };
    $scope.stop = function() {
      if (automilk) {
        $interval.cancel(automilk);
        automilk = null;
      }
    };
    $scope.$on('$destroy', function() {
      $scope.stop();
    });
    function checkAutoMilk() {
      if ($scope.context.user.auto && !automilk)
        $scope.start();
      else if (!$scope.context.user.auto && automilk)
        $scope.stop();
    }

    function parse(v,min,max) {
      var rv = parseInt(v) || 0;
      if (rv<min) rv=min;
      if (rv>max) rv=max;
      return rv;
    }

    function getMinutes(t) {
      if (!t) return 0;
      var pattern = /\d+/g;
      var values = t.match(pattern);
      var mt = 0;
      if (values && values.length>0) {
        var h = parse(values[0],0,23);
        var m = 0;
        if (values.length>1) {
          m = parse(values[1],0,59);
        }
        mt = h*60+m;
      }
      return mt;
    }

    function isLunch(e, u) {
      return (u>0 && e>0 && e>(12*60+30) && u<(14*60+30));
    }

    function getTime(m) {
      var hT = Math.floor(m/60);
      var mT = m-(hT*60);
      if (mT.toString().length<2) mT='0'+mT;
      return hT+':'+mT;
    }

    var days = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
    var months = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    $scope.getDate  = function() {
      var date = new Date();
      return days[date.getDay()-1]+' '+date.getDate()+' '+months[date.getMonth()]+' '+date.getFullYear();
    };

    $scope.recalc = function(){
      var mP = 0;
      var mE = 0;
      var mT = getMinutes($scope.context.o);
      var mPP = getMinutes($scope.context.p);
      var mL = 0;
      var lastok = false;
      var firstE = 0;
      var lastE = 0;
      var m1 = 0, m2 = 0;
      var lunch = false;
      var lunchable = true;
      $scope.context.items.forEach(function(i){
        m1 = getMinutes(i.E);
        /// il minimo ingresso è alle 8:30
        if (m1<(8*60+30))
          m1 = (8*60+30);
        /// la pausa pranzo va da un minimo di 30min ad un massimo di 90min
        if (!lunch && isLunch(m1,m2)) {
          lunch = true;
          i.lunch = true;
          var p = m1 - m2;
          if (p<30) { mP = 30 - p; p = 30; }
          if (p>90) { mP = p - 90; p = 90; }
          i.L = getTime(p);
        }
        else i.lunch = false;
        m2 = getMinutes(i.U);
        lastok = (m2 > m1);
        if (lastok) {
          var l = (m2 - m1);
          i.minutes = getTime(l);
          mL += l;
        }
        else i.minutes = 0;

        if (m1>0 && i.E) {
          lastE = m1;
          if (firstE == 0) {
            firstE = m1;
            /// l'ingresso dopo le 9:00 va scaglionato sulle mezz'ore
            if (firstE>(9*60) && mPP<4){
              var meT = firstE - (9*60);
              var meM = Math.floor(meT / 30);
              if (meM*30<meT) meM++;
              mE = meM*30-meT;
            }
            if (mPP>=4)
              lunchable = false;
          }
          if (m2>0)
            lastE = m2
        }
      });
      if (lastok)
        $scope.context.items.push({E:'',U:''});
      if (!lunch && lunchable)
        mP = 30;
      var r = lastE+mT-mL+mP-mPP+mE;

      $scope.context.exit = (r>(8*60) && r<(23*60)) ? getTime(r) : '?';
    };

    $scope.clear = function() {
      var u = ($scope.context) ? $scope.context.user : {};
      $scope.context = {
        user: u,
        o:'8',
        p:'0',
        exit:'?',
        items: [{
          E:'8:30',
          U:''
        }],
        debug:{}
      };
    };

    $scope.clear();

    $scope.toggleAutoInaz = function() {
      $scope.context.user.auto = !$scope.context.user.auto;
      checkAutoMilk();
    };

    $scope.inazall = function() {
      if ($scope.context.allDaysItems && $scope.context.allDaysItems.length)
        $scope.context.allDaysItems = [];
      else
        milkinaz(true);
    };

    $scope.inaz = function() {
      if (!$scope.context.user.name || !$scope.context.user.password || $scope.context.user.auto)
        return;
      milkinaz();
    };

    /**
     * C0 - numero
     * C1 - data (dd/MM/yyyy)
     * C2 - ora
     * C3 - minuti
     * C4 - tipo (E o U)
     */
    function addItems(daysItems,day,dayItems) {
      if (dayItems.length)
        daysItems.push({day: day, items: dayItems.sort(function (i1, i2) {
          if (i1.time > i2.time) return 1;
          if (i1.time < i2.time) return -1;
          return 0;
        })});
    }

    $scope.calcAllItems = function() {
      if (!$scope.context.allitems || $scope.context.allitems.length<=0) return;
      var dayItems = [], daysItems = [];
      var day = '';
      $scope.context.allitems.forEach(function(i){
        if (day != i['C1']){
          addItems(daysItems,day,dayItems);
          day = i['C1']; dayItems = [];
        }
        i.time = getMinutes(i['C2']+':'+i['C3']);
        dayItems.push(i);
      });
      addItems(daysItems,day,dayItems);
      $scope.context.allDaysItems = daysItems;
    };
  }]);
