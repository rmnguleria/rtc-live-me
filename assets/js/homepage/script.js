// for handling displaying the register dropdown when non register uses click broadcast button
$(document).ready( function(){
  $('#broadcaster').click(function(event) {
    event.stopPropagation();
    $('#registermenu a').trigger('click');
  });
});