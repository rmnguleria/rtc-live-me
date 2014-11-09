//Toggle dropdown to show flash message if there was a problem with login
if($('#flashLogin').text().length > 0){
  $('#loginmenu').addClass('open');
}

//Toggle dropdown to show flash message if there was a problem with registering
if($('#flashRegister').text().length > 0){
  $('#registermenu').addClass('open');
}

// Handle logout redirect
$('#logout').click(function() {
 $.post(
  '/logout',
    function(){
      location.reload(true);
    }
  );
});