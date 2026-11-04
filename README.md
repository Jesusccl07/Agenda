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

## Calendarios: cada uno el suyo; en la app se ven los de los dos
- Cada cuenta de Google tiene su **propio calendario «turnos_dj»**. Al iniciar sesión la app lo busca; si no existe, renombra el antiguo «Nexora» de esa cuenta o **crea uno nuevo** (lo verás en Google Calendar).
- La primera vez la app pregunta **«¿De quién es esta cuenta?»** (CLEMENT o DJ BOTA). Si tu socio ya lo eligió, se deduce sola. Se puede cambiar en *Ajustes*.
- **Cada turno se guarda en el calendario de su DJ**: los de CLEMENT en el de CLEMENT y los de DJ BOTA en el de DJ BOTA, los apunte quien los apunte. Los de **Two Generation's se copian en los dos** (añadirlos, cambiarlos o borrarlos en uno se refleja en el otro, también desde Google Calendar).
- **En la app veis los turnos de los dos**: en el panel de tu socio salen los turnos de su calendario en cuanto te lo comparta. Si solo te deja verlo, salen como «Solo ver».
- **En Google Calendar, cada uno solo tiene lo suyo**: tus turnos y los de Two Generation's. El calendario de tu socio queda oculto en tu Google Calendar (la app lo lee, pero no te llena el calendario con sus turnos).
- **Compartir desde la app**: *Ajustes → Compartir con tu socio* → escribe su correo → *Compartir* → *Enviar por WhatsApp*. Cuando tu socio abre ese enlace con su cuenta en la app, ve tus turnos al momento (no se envía ningún correo de Google) y la app le ofrece compartirte el suyo con un toque.
- **Hasta que no se comparte, cada uno solo ve lo de su calendario**: los turnos de Two Generation's que estén en el calendario del otro no salen hasta abrir su enlace. La app avisa con un recuadro «Conecta con el calendario de…».
- Si en tu calendario quedaron turnos de tu socio (de cuando había un solo calendario), *Ajustes* ofrece **pasarlos al suyo**.

## Avisos en el móvil
- Cada turno avisa **el día antes y 2 horas antes** (se puede cambiar en *Ajustes → Avisos en el móvil*: también 1 hora o 30 minutos antes).
- Los avisos los muestra la **app de Google Calendar** del móvil: tenla instalada, con tu cuenta y las notificaciones activadas. Valen para los turnos de tu calendario: los tuyos y los de Two Generation's.

### Autorizar otra cuenta (por ejemplo, la de tu padre)
Si en Google Cloud Console la pantalla de consentimiento está en modo *Prueba* (Testing), añade su correo en *Google Auth Platform → Público (Audience) → Usuarios de prueba*. Si no, Google le mostrará «Acceso bloqueado». Si Google avisa de que la app no está verificada: *Configuración avanzada → Ir a…*.

Permisos que pide al iniciar sesión con Google: gestionar tus calendarios (para crear y renombrar «turnos_dj», compartirlo con tu socio, poner los avisos y guardar los turnos en el calendario de cada uno) y ver tu nombre/correo.

## Instalarla como app
Abre el enlace en Safari (iPhone) o Chrome (Android) → *Añadir a pantalla de inicio*.

Para ver el **icono nuevo** en el iPhone hay que borrar el acceso de la pantalla de inicio y volver a añadirlo (en Android se actualiza solo con el tiempo).
