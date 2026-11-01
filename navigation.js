const navigation = document.querySelector('.mobile-navigation');
if (navigation) {
  document.addEventListener('pointerdown', event => {
    if (!navigation.contains(event.target)) navigation.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation.open) {
      navigation.open = false;
      navigation.querySelector('summary').focus();
    }
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) navigation.open = false;
  });
  matchMedia('(max-width: 760px)').addEventListener('change', () => {
    navigation.open = false;
  });
}
