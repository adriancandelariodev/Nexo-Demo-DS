// Aviso flotante (toast) compartido por toda la app
export const aviso = $state({ texto: '', visible: false });

let temporizador;
export function toast(texto) {
  aviso.texto = texto;
  aviso.visible = true;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => (aviso.visible = false), 2800);
}
