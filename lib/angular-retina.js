// Add support for Retina displays when using element attribute "ng-src".
// This module overrides the built-in directive "ng-src" with one which
// distinguishes between standard or high-resolution (Retina) displays.

(function (
  angular,
  undefined
) {
  'use strict';
  var infix = '@2x',
    dataUrlRegex = /^data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    allowedImageTypesRegex = /(png|jp[e]?g)$/,
    fadeInWhenLoaded = false,
    loadErrorHandler = angular.noop;

  var ngRetina = angular.module('ngRetina', [])
    .config(['$provide', function ($provide) {
      $provide.decorator('ngSrcDirective', ['$delegate', function ($delegate) {
        $delegate[0].compile = function (
          element,
          attrs
        ) {
          // intentionally empty to override the built-in directive ng-src
        };
        return $delegate;
      }]);
    }]);

  // From https://gist.github.com/bgrins/6194623#gistcomment-1671744
  function isDataUri(uri) {
    return new RegExp(/^\s*data:([a-z]+\/[a-z0-9\-\+]+(;[a-z\-]+\=[a-z0-9\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i).test(uri);
  }

  ngRetina.provider('ngRetina', function () {
    this.setInfix = function setInfix(value) {
      infix = value;
    };

    this.setFadeInWhenLoaded = function setFadeInWhenLoaded(value) {
      fadeInWhenLoaded = value;
    };

    this.setLoadErrorHandler = function setLoadErrorHandler(handler) {
      loadErrorHandler = handler;
    };

    this.$get = angular.noop;
  });

  ngRetina.directive('ngSrc', ['$window', '$http', '$log', function (
    $window,
    $http,
    $log
  ) {
    var msie = parseInt(((/msie (\d+)/.exec($window.navigator.userAgent.toLowerCase()) || [])[1]), 10);
    var isRetina = ((function () {
      var mediaQuery = '(-webkit-min-device-pixel-ratio: 1.5), (min--moz-device-pixel-ratio: 1.5), ' +
        '(-o-min-device-pixel-ratio: 3/2), (min-resolution: 1.5dppx)';
      if ($window.devicePixelRatio > 1) {
        return true;
      }
      return $window.matchMedia && $window.matchMedia(mediaQuery).matches;
    })());

    function getPathname(url) {
      var parser = document.createElement('a');
      parser.href = url;
      return parser.pathname;
    }

    function getHighResolutionURL(url) {
      var pathname = getPathname(url);
      var parts = pathname.split('.');
      if (parts.length < 2) {
        return url;
      }
      parts[parts.length - 2] += infix;
      var pathname2x = parts.join('.');
      return url.replace(pathname, pathname2x);
    }

    return function (
      scope,
      element,
      attrs
    ) {
      function getSessionStorageItem(imageUrl) {
        var item;
        try {
          item = $window.sessionStorage.getItem(imageUrl);
        } catch (e) {
          $log.warn('sessionStorage not supported');
          item = imageUrl;
        }
        return item;
      }

      function setSessionStorageItem(
        imageUrl,
        imageUrl2x
      ) {
        try {
          $window.sessionStorage.setItem(imageUrl, imageUrl2x);
        } catch (e) {
          $log.warn('sessionStorage not supported');
        }
      }

      function get2xImageURL(imageUrl) {
        return attrs.at2x || getSessionStorageItem(imageUrl);
      }

      function isCurrImgSrc(imgSrc) {
        var currImgSrc = attrs.ngSrc;
        var currImgSrc2x = get2xImageURL(currImgSrc);
        return currImgSrc === imgSrc || currImgSrc2x === imgSrc;
      }

      function setImgSrc(imageUrl) {
        if (!isCurrImgSrc(imageUrl)) return;

        element.on('error', loadErrorHandler);

        attrs.$set('src', imageUrl);
        if (msie) {
          element.prop('src', imageUrl);
        }
      }

      function set2xVariant(imageUrl) {
        var imageUrl2x = get2xImageURL(imageUrl);

        if (!imageUrl2x) {
          imageUrl2x = getHighResolutionURL(imageUrl);
          var request = {
            method: imageUrl2x.indexOf('?') < 0 ? 'HEAD' : 'GET',
            url: imageUrl2x
          };
          $http(request)
            .then(function (
              data,
              status
            ) {
              setSessionStorageItem(imageUrl, imageUrl2x);
              setImgSrc(imageUrl2x);
            })
            .catch(function (
              data,
              status,
              headers,
              config
            ) {
              setSessionStorageItem(imageUrl, imageUrl);
              setImgSrc(imageUrl);
            });
        } else {
          setImgSrc(imageUrl2x);
        }
      }

      attrs.$observe('ngSrc', function (
        imageUrl,
        oldValue
      ) {
        if (!imageUrl) {
          return;
        }

        if (isDataUri(imageUrl)) {
          return setImgSrc(imageUrl);
        }

        if (fadeInWhenLoaded && !getSessionStorageItem('fadedIn-' + imageUrl)) {
          element.css({
            opacity: 0,
            '-o-transition': 'opacity 0.5s ease-out',
            '-moz-transition': 'opacity 0.5s ease-out',
            '-webkit-transition': 'opacity 0.5s ease-out',
            'transition': 'opacity 0.5s ease-out'
          });
          element.on('load', function () {
            setSessionStorageItem('fadedIn-' + imageUrl, true);
            element.css('opacity', 1);
          });
        }

        if (isRetina &&
          angular.isUndefined(attrs.noretina) &&
          element[0].tagName === 'IMG' &&
          getPathname(imageUrl).match(allowedImageTypesRegex) && !imageUrl.match(dataUrlRegex)) {
          set2xVariant(imageUrl);
        } else {
          setImgSrc(imageUrl);
        }
      });
    };
  }]);
})(window.angular);
