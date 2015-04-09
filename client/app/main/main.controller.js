/**
 * Created by Leo on 01/04/2015.
 */
'use strict';

angular.module('Quando')
  .controller('TempiCtrl', ['$scope','$http','$interval', function ($scope,$http,$interval) {
    var alarm = new Audio('assets/media/alarm.mp3');
    var alarmOwner;
    var _tick;

    $scope.helpon = false;

    $scope.context = {
      o:'8',
      exit:'?',
      items: [{
        E:'8:30',
        U:''
      }],
      alarms:false,
      debug:{}
    };

    $scope.instractions = {
      title:'Cosa puoi fare con QUANDO?',
      footer:'Se non ti basta .....',
      sections:[{
        icon:'fa-clock-o',
        title:'Puoi simulare le tue entrate ed uscite...',
        desc:'Inserendo le tue entrate e le tue uscite otterrai in automatico l\'individuazione della pausa pranzo e l\'ora di uscita.'
      },{
        icon:'fa-clock-o',
        title:'Puoi impostare le ore di lavoro e di permesso...',
        desc:'Valorizzando correttamente le ore di permesso o di lavoro nel giorno puoi variare il calcolo dell\'ora di uscita.'
      },{
        icon:'fa-cloud-download',
        title:'Con le credenziali INAZ acquisisci i dati reali...',
        desc:'Inserendo le credenziali INAZ puoi scaricare manualmente le bedgiature cliccando sulla nuvoletta.\r\nOppure, attivando l\'interruttore puoi lasciare fare all\'applicazione che allinerà i dati ogni mezzo minuto.'
      },{
        icon:'fa-calendar',
        title:'Vedere lo storico dell\'ultima settimana...',
        desc:'Inserendo le credenziali INAZ puoi scaricare lo storico degli ultimi giorni cliccando sul calendarino sulla destra.'
      },{
        icon:'fa-bullhorn',
        title:'Aggiungere un allarme per ogni orario che desideri...',
        desc:'Attivando il megafonino in basso a sinistra puoi farti avvisare acusticamente (quindi devi avere il volume e degli altoparlanti attivi) all\'ora d\'uscita e, attivandoli separatamente ad ogni orario definito (altoparlantino nella cella dell\'orario valorizzato).'
      }]
    };

    function timeCompare(r1, r2) {
      if (r1.time > r2.time) return 1;
      if (r1.time < r2.time) return -1;
      return 0;
    }

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
              data.forEach(function(r){ r.time = getMinutes(r['C2']+':'+r['C3']); });
              data.sort(timeCompare);

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

    function calcMinutes(i, type) {
      var m = getMinutes(i[type]);
      i[type+'M']=m;
      return m;
    }

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
        m1 = calcMinutes(i,'E');
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
        m2 = calcMinutes(i,'U');
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

      if (r<=(8*60) || r>=(23*60)) r = 0;

      $scope.context.exitm = r;
      $scope.context.exit = (r>0) ? getTime(r) : '?';
      watchTime();
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
        daysItems.push({day: day, items: dayItems.sort(timeCompare)});
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

    function getNowM() {
      var now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    }

    function activateItemAlarm(item, property) {
      alarmOwner={i:item,p:property};
      $scope.alarm();
      return true;
    }

    function watchTime() {
      if (angular.isDefined(_tick) || !$scope.context.alarms) return;
      _tick = $interval(function () {
        var nowm = getNowM();
        //verifica orario uscita
        if ($scope.context.exitm && alarm.paused && nowm>=$scope.context.exitm) {
          $scope.alarmed = true;
          $scope.alarm();
        }
        else {
          //verifica orari intermedi
          $scope.context.items.some(function (i) {
            if (i['EM'] && i['EM']<=nowm && i.ealarm){
              return activateItemAlarm(i, 'ealarm');
            }
            else if (i['UM'] && i['UM']<=nowm && i.ualarm){
              return activateItemAlarm(i, 'ualarm');
            }
            return false;
          });
        }
      }, 10000);
    }

    function stopWatchTime() {
      if (angular.isDefined(_tick)) {
        $interval.cancel(_tick);
        _tick = undefined;
      }
      $scope.alarmed = false;
    }

    $scope.alarm = function() {
      if (alarm.paused) {
        if ($scope.context.alarms)
          alarm.play();
        if (alarmOwner)
          alarmOwner.i[alarmOwner.p+'ed'] = true;
      }
      else {
        alarm.pause();
        if (!alarmOwner)
          stopWatchTime();
        if (alarmOwner) {
          alarmOwner.i[alarmOwner.p+'ed'] = false;
          alarmOwner.i[alarmOwner.p] = false;
          alarmOwner = null;
        }
      }
      $scope.isalarm =!alarm.paused;
    };

    $scope.toggleAlarms = function() {
      if ($scope.context.alarms){
        $scope.context.alarms = false;
        stopWatchTime();
        if (!alarm.paused)
          $scope.alarm();
      }
      else {
        $scope.context.alarms = true;
        watchTime();
      }
    };

    $scope.help = function() {
      $scope.helpon = !$scope.helpon;
    };

    $scope.recalc();
  }]);
