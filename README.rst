Loading Observer
================

About
-----

This provides the watching of loading.
Returns jQuery.Deferred watching of a image, a script and an iframe.

Usage
-----

::

  $('img').loaded().success(function () {
    alert('loaded: ' + this.src);
  }).error(function () {
    alert('error: ' + this.src);
  });
