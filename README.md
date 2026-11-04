# 🎧 Turnos DJ

App móvil (PWA) con los turnos, cachés e ingresos de **CLEMENT** y **DJ Bota**, guardados en Google Calendar, en un calendario llamado «turnos_dj» de cada cuenta. Funciona sin conexión.

Ábrela en: https://jesusccl07.github.io/Agenda/turnos/

(La dirección https://jesusccl07.github.io/Agenda/ también lleva directamente a Turnos DJ.)

- Al abrir eliges agenda (CLEMENT o DJ Bota). Los turnos marcados como *Two Generation's* salen en las dos.
- Panel de administración con estilo *Liquid Glass*: paneles de cristal sobre luces de sala animadas (cian y violeta para CLEMENT, naranja y magenta para DJ Bota).
- Cifras con minigráficas y comparación con el periodo anterior (este mes, este año o todo): ingresos, turnos, horas en cabina y caché medio.
- Próximo turno con cuenta atrás en directo, próximos 7 días, gráfico de ingresos por mes (cobrado y previsto), tabla de turnos con buscador, calendario con alta rápida («DJ LA CLUB»: viernes 80 €, sábado 100 €), ranking de locales que más pagan y objetivo del mes.
- Añadir, modificar y borrar turnos desde la app: se guardan en Google Calendar. Sin internet se guardan en el móvil y se envían al reconectar.
- Se actualiza sola cada minuto con la app abierta.
- Cada turno usa en la descripción del evento el formato `🎤 DJ: … / 📍 Lugar / 🏢 Local / 💰 Caché / ⏰ Horario / 🕐 Duración / 🎒 Llevar`.

## Calendarios: cada uno el suyo, Two Generation's en los dos
- Cada cuenta de Google tiene su **propio calendario «turnos_dj»**. Al iniciar sesión la app lo busca; si no existe, renombra el antiguo «Nexora» de esa cuenta o crea uno nuevo.
- Los turnos de CLEMENT o de DJ Bota se quedan solo en el calendario de quien los apunta.
- Los turnos de **Two Generation's se copian en los dos calendarios**: añadirlos, modificarlos o borrarlos desde cualquiera de los dos se refleja en el otro (también si se cambian directamente en Google Calendar).
- Para que la copia funcione, **cada uno comparte su «turnos_dj» con el otro**: Google Calendar (en el ordenador) → turnos_dj → *Configuración y uso compartido* → *Compartir con determinadas personas* → añade el correo del otro con el permiso **«Hacer cambios en eventos»** (el otro tiene que aceptar la invitación).
- En *Ajustes* se ve tu calendario y si el del socio está compartido. Desde ahí también puedes *Cambiar de cuenta*.

### Autorizar otra cuenta (por ejemplo, la de tu padre)
Si en Google Cloud Console la pantalla de consentimiento está en modo *Prueba* (Testing), añade su correo en *Google Auth Platform → Público (Audience) → Usuarios de prueba*. Si no, Google le mostrará «Acceso bloqueado». Si Google avisa de que la app no está verificada: *Configuración avanzada → Ir a…*.

Permisos que pide al iniciar sesión con Google: gestionar tus calendarios (para crear y renombrar «turnos_dj» y copiar los turnos de Two Generation's en el del socio) y ver tu nombre/correo.

## Instalarla como app
Abre el enlace en Safari (iPhone) o Chrome (Android) → *Añadir a pantalla de inicio*.
