/* ============================================================
   MediConnect · datos.js
   Catalogo ficticio de la demo: medicos, aseguradoras,
   especialidades, sintomas, farmacias, examenes y preguntas.

   Son DATOS DE EJEMPLO. Ningun dato real de pacientes vive aqui.
   ============================================================ */

/* Horarios que la clinica ofrece cada dia habil (hora de pared) */
export const HORARIOS = ['08:00', '09:00', '10:30', '11:00', '14:00', '15:30'];

/* ------------------------------------------------------------
   Medicos
   `agenda` = en que horarios atiende cada quien. Es lo que hace
   que dos medicos tengan disponibilidad distinta el mismo dia.
   ------------------------------------------------------------ */
export const medicos = [
  { id:'tak', n:'Dr. Takashi', short:'Takashi', sp:'Medicina general', chip:'General', tag:'General',
    place:'Escalón', room:'Consultorio 3 · 2.º piso', rate:'4.7', revs:96, yrs:18, price:35, phone:'2200-1003',
    nets:['sisa','assa','asesuisa','mapfre','pal'],
    desc:'Médico de familia: chequeos, gripe, presión y diabetes.',
    agenda:['08:00','09:00','10:30','11:00','14:00','15:30'],
    f:{photo:'tak',bg:'#DCE6F7',skin:'#E9C4A3',hc:'#1E1E24',hair:'short',shirt:'#2F6FB5',coat:true,glasses:true} },

  { id:'riv', n:'Dra. Ana Rivas', short:'Rivas', sp:'Dermatología', chip:'Piel', tag:'Piel',
    place:'San Benito', room:'Consultorio 5 · 3.er piso', rate:'4.5', revs:64, yrs:12, price:40, phone:'2200-1005',
    nets:['sisa','mapfre','atlantida'],
    desc:'Cuida tu piel: acné, manchas, alergias y lunares.',
    agenda:['09:00','10:30','11:00','14:00'],
    f:{photo:'riv',bg:'#E7E2F7',skin:'#C98E6B',hc:'#3A2418',hair:'long',shirt:'#6A4FE0',coat:true} },

  { id:'her', n:'Dr. Luis Herrera', short:'Herrera', sp:'Cardiología', chip:'Corazón', tag:'Corazón',
    place:'Escalón', room:'Consultorio 8 · 3.er piso', rate:'4.7', revs:128, yrs:20, price:35, phone:'2200-1008',
    nets:['sisa','assa','asesuisa','pal','acsa'],
    desc:'Cuida tu corazón: chequeos, presión alta y colesterol.',
    agenda:['08:00','09:00','11:00','14:00','15:30'],
    f:{photo:'her',bg:'#F7E3DC',skin:'#8D5A3B',hc:'#15171C',hair:'short',shirt:'#B4321F',coat:true} },

  { id:'pen', n:'Dr. Carlos Peña', short:'Peña', sp:'Pediatría', chip:'Niños', tag:'Niños',
    place:'Antiguo Cuscatlán', room:'Consultorio 2 · 1.er piso', rate:'4.8', revs:150, yrs:15, price:30, phone:'2200-1002',
    nets:['sisa','mapfre','asesuisa'],
    desc:'Controles de niño sano, vacunas y enfermedades comunes.',
    agenda:['08:00','09:00','10:30','14:00','15:30'],
    f:{photo:'pen',bg:'#DDEEDB',skin:'#E0B38E',hc:'#4A3020',hair:'short',shirt:'#0E7C6B',coat:true} },

  { id:'pin', n:'Dra. Laura Pineda', short:'Pineda', sp:'Ginecología', chip:'Mujer', tag:'Mujer',
    place:'San Benito', room:'Consultorio 6 · 3.er piso', rate:'4.9', revs:210, yrs:14, price:40, phone:'2200-1006',
    nets:['sisa','pal','atlantida'],
    desc:'Control ginecológico, embarazo y planificación familiar.',
    agenda:['08:00','10:30','11:00','15:30'],
    f:{photo:'pin',bg:'#FBEBC4',skin:'#F1D2B6',hc:'#6B4A00',hair:'bun',shirt:'#9A5E06',coat:true} },

  { id:'men', n:'Dra. Sofía Méndez', short:'Méndez', sp:'Nutrición', chip:'Nutrición', tag:'Nutrición',
    place:'Escalón', room:'Consultorio 2 · 1.er piso', rate:'4.6', revs:58, yrs:8, price:30, phone:'2200-1004',
    nets:['mapfre','asesuisa'],
    desc:'Planes de alimentación para tu peso, energía y salud.',
    agenda:['09:00','10:30','14:00','15:30'],
    f:{photo:'men',bg:'#E3F5EA',skin:'#C98E6B',hc:'#2A1C14',hair:'long',shirt:'#157F44',coat:true} }
];

export const medico = (id) => medicos.find(d => d.id === id);

/* Articulo correcto segun el nombre: 'el Dr. Herrera' / 'la Dra. Rivas' */
export const esDoctora = (d) => d.n.startsWith('Dra.');
export const nombreCon = (d) => (esDoctora(d) ? 'la Dra. ' : 'el Dr. ') + d.short;
export const NombreCon = (d) => (esDoctora(d) ? 'La Dra. ' : 'El Dr. ') + d.short;

/* ------------------------------------------------------------
   Aseguradoras
   ------------------------------------------------------------ */
export const aseguradoras = [
  { id:'asesuisa',    n:'Asesuisa', m:'AS' },
  { id:'acsa',        n:'ACSA', m:'AC' },
  { id:'mapfre',      n:'MAPFRE', m:'MA' },
  { id:'assa',        n:'ASSA Compañía de Seguros', m:'AS' },
  { id:'pal',         n:'Pan-American Life (PALIC)', m:'PA' },
  { id:'atlantida',   n:'Seguros Atlántida', m:'AT' },
  { id:'sisa',        n:'SISA', m:'SI' },
  { id:'fedecredito', n:'Seguros Fedecrédito', m:'FE' },
  { id:'abank',       n:'Seguros Abank', m:'AB' }
];
export const aseguradora = (id) => aseguradoras.find(i => i.id === id);
export const nombreCortoSeguro = (id) => (aseguradora(id)?.n || '').split(' ')[0];

/* ------------------------------------------------------------
   Especialidades (para la hoja "Más")
   ------------------------------------------------------------ */
export const especialidades = [
  ['activity','Medicina general','General','bsoft'],
  ['baby','Pediatría','Niños','ok'],
  ['thermo','Dermatología','Piel','warn'],
  ['heart','Cardiología','Corazón','bsoft'],
  ['user','Ginecología','Mujer','ok'],
  ['pill','Nutrición','Nutrición','warn'],
  ['bone','Traumatología','Huesos','field'],
  ['eye','Oftalmología','Ojos','field']
];

/* ------------------------------------------------------------
   Sintomas
   ------------------------------------------------------------ */
export const sintomasComunes = ['Fiebre','Dolor de garganta','Tos','Dolor de cabeza','Cansancio','Náuseas','Mareo','Dolor de estómago'];
export const sintomasMas     = ['Escalofríos','Congestión nasal','Falta de aire','Dolor de espalda','Dolor de oído','Sarpullido','Picazón','Diarrea','Vómito','Insomnio','Ansiedad','Visión borrosa','Dolor de pecho','Dolor muscular'];

/* ------------------------------------------------------------
   Farmacias (mapa ilustrado)
   ------------------------------------------------------------ */
export const farmacias = [
  { n:'Farmacias San Nicolás', s:'Sucursal Escalón', km:'1.2 km', m:'SN', x:58, y:36 },
  { n:'Farmacias Económicas',  s:'Paseo Escalón',    km:'1.8 km', m:'E',  x:30, y:58 },
  { n:'Farmacias San Nicolás', s:'Las Palmas',       km:'2.3 km', m:'SN', x:72, y:68 },
  { n:'Farmacia Camila',       s:'Cumbres de Cuscatlán', km:'3.4 km', m:'C', x:20, y:28 },
  { n:'Farmacias Económicas',  s:'El Pedregal',      km:'4.1 km', m:'E',  x:84, y:22 }
];

/* ------------------------------------------------------------
   Examenes de ejemplo del expediente
   ------------------------------------------------------------ */
export const examenes = {
  bp: { n:'Presión arterial', date:'12 sep 2026 · 9:10 a. m.', st:'Normal', cls:'okp',
        lab:'Centro Médico Escalón', branch:'Consultorio 8 · tomada en tu consulta', by:'her',
        note:'Medida por enfermería antes de tu cita',
        rows:[['Sistólica','118','mmHg','Ideal: menos de 120',0],
              ['Diastólica','76','mmHg','Ideal: menos de 80',0],
              ['Pulso','72','lpm','Normal: 60 a 100',0]] },

  hemo:{ n:'Hemograma completo', date:'20 ago 2026 · 9:40 a. m.', st:'Normal', cls:'okp',
        lab:'Laboratorio Clínico Max Bloch', branch:'Casa matriz · Colonia Médica, San Salvador', by:'her',
        note:'Laboratorio acreditado ISO 15189',
        rows:[['Hemoglobina','14.8','g/dL','Referencia: 13.5 a 17.5',0],
              ['Glóbulos blancos','7,200','/µL','Referencia: 4,500 a 11,000',0],
              ['Plaquetas','250,000','/µL','Referencia: 150,000 a 450,000',0],
              ['Hematocrito','44','%','Referencia: 40 a 52',0]] },

  lip: { n:'Perfil lipídico', date:'20 ago 2026 · 7:15 a. m.', st:'Revisar', cls:'warnp',
        lab:'Analiza Laboratorios', branch:'Sucursal C.C. Las Ramblas, Santa Ana', by:'tak',
        note:'Muestra en ayunas de 12 horas',
        rows:[['Colesterol total','212','mg/dL','Ideal: menos de 200',1],
              ['HDL (bueno)','48','mg/dL','Ideal: más de 40',0],
              ['LDL (malo)','138','mg/dL','Ideal: menos de 130',1],
              ['Triglicéridos','160','mg/dL','Ideal: menos de 150',1]] },

  glu: { n:'Glucosa en ayunas', date:'20 ago 2026 · 7:20 a. m.', st:'Normal', cls:'okp',
        lab:'Hospital de Diagnóstico · Laboratorio', branch:'Colonia Médica, San Salvador', by:'tak',
        note:'Muestra en ayunas de 8 horas',
        rows:[['Glucosa','92','mg/dL','Normal: 70 a 99',0]] }
};

/* ------------------------------------------------------------
   Preguntas frecuentes
   ------------------------------------------------------------ */
export const preguntas = [
  ['¿Cómo cancelo o cambio mi cita?',
   'Entrá a tu cita desde Inicio y tocá “Cambiar o cancelar”. Podés hacerlo sin costo hasta 4 horas antes.'],
  ['¿Qué pasa si mi seguro no cubre la consulta?',
   'Tu cita queda apartada igual. Podés pagar con tarjeta en la app o en caja al llegar. (El cobro es simulado en esta demo.)'],
  ['¿Dónde veo mis resultados?',
   'En Expediente → Resultados. Son resultados de ejemplo, parte de la simulación académica.'],
  ['¿Me llega un correo cuando reservo?',
   'Sí, si creaste tu cuenta con un correo válido y la automatización está conectada. En la cita vas a ver el estado real del envío.'],
  ['¿Esto guarda mis datos médicos?',
   'No. Es un prototipo académico: todo se guarda solo en este teléfono y no pedimos información médica sensible.']
];

/* ------------------------------------------------------------
   Textos del recorrido academico. El panel del presentador los
   usa y el guion de la exposicion sigue este mismo orden.
   ------------------------------------------------------------ */
export const CASOS = [
  { id:'C1', titulo:'Agendar sin cupos',        resumen:'La agenda solo ofrece horarios libres y rechaza los ocupados', salto:'c1' },
  { id:'C2', titulo:'Check-in, cambio y cancelación', resumen:'Pase QR para llegar, o reprogramar y cancelar liberando el horario', salto:'c2' },
  { id:'C3', titulo:'Seguro válido: $0',        resumen:'Póliza vigente y el médico la acepta', salto:'c3' },
  { id:'C4', titulo:'Seguro rechazado o sin seguro', resumen:'Póliza vencida, no aceptada o pago rechazado', salto:'c4' },
  { id:'C5', titulo:'Consulta médica',          resumen:'La fila avanza sola hasta tu turno y el médico ve tu motivo', salto:'c5' },
  { id:'C6', titulo:'Requiere laboratorio',     resumen:'Se genera la orden y el resultado llega al expediente', salto:'c6' },
  { id:'C7', titulo:'Cierre y expediente',      resumen:'Diagnóstico, receta, pago y calificación', salto:'c7' },
  { id:'C8', titulo:'Cita de seguimiento',      resumen:'El ciclo vuelve a empezar desde el calendario', salto:'c8' }
];
