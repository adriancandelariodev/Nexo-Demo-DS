<script>
  // Estilos globales, en el mismo orden que el styles.css original
  import '../styles/01-base.css';
  import '../styles/02-estructura.css';
  import '../styles/03-animaciones-3d.css';
  import '../styles/04-menu-y-login.css';
  import '../styles/05-hero-y-widgets.css';
  import '../styles/06-panel.css';
  import '../styles/07-formularios.css';
  import '../styles/08-tablero.css';
  import '../styles/09-ventanas.css';
  import '../styles/10-responsive.css';
  import '../styles/11-login-red-neuronal.css';

  let { children } = $props();
</script>

{@render children()}
