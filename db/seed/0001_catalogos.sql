-- Datos semilla de catálogos del Método Compás v2
BEGIN;
INSERT INTO ref.fuente_metodologica(codigo, titulo, autor, anio) VALUES
 ('YNAB','You Need a Budget','Jesse Mecham',2017),
 ('RAMSEY','The Total Money Makeover','Dave Ramsey',2003),
 ('YMOYL','Your Money or Your Life','Vicki Robin, Joe Dominguez',1992),
 ('SETHI','I Will Teach You to Be Rich','Ramit Sethi',2009),
 ('WARREN','All Your Worth','Elizabeth Warren, Amelia Warren Tyagi',2005),
 ('KAKEIBO','Kakeibo','Hani Motoko',1904),
 ('BCCH','Informe de Estabilidad Financiera — carga financiera de hogares','Banco Central de Chile',NULL),
 ('FINHEALTH','FinHealth Score','Financial Health Network',NULL),
 ('STANLEY','The Millionaire Next Door','Thomas Stanley, William Danko',1996),
 ('SMART','Save More Tomorrow','Richard Thaler, Shlomo Benartzi',2004),
 ('COMPAS','Método Compás v2 (decisión de diseño)','Proyecto Compás',2026);

INSERT INTO ref.bloque VALUES
 ('ESENCIALES','Esenciales',50,'max'),('FUTURO','Futuro',20,'min'),('VIDA','Vida',30,'max');

INSERT INTO ref.etapa(codigo,orden,nombre,criterio_entrada,criterio_salida,futuro_min_pct,descripcion) VALUES
 ('E0',0,'Estabilizar','{"pago_esencial_atrasado":true}','{"meses_pagos_al_dia":2}',1,'Cuatro Paredes primero'),
 ('E1',1,'Colchón inicial','{"meses_pagos_al_dia":2}','{"meses_reserva_min":1}',NULL,'Futuro mínimo = aporte a emergencia'),
 ('E2',2,'Desendeudar','{"meses_reserva_min":1}','{"deuda_consumo":0}',5,'Deuda objetivo según R21'),
 ('E3',3,'Proteger','{"deuda_consumo":0}','{"meses_reserva_min":3}',10,'Emergencia hasta 3–6 meses'),
 ('E4',4,'Construir','{"meses_reserva_min":3}','{"tasa_ahorro_min":20,"meses_consecutivos":12}',20,NULL),
 ('E5',5,'Libertad','{"tasa_ahorro_min":20,"meses_consecutivos":12}','{"punto_cruce":true}',20,'Punto de cruce');

INSERT INTO ref.flujo_etapa(etapa_codigo,orden,destino) VALUES
 ('E0',1,'cuatro_paredes'),('E0',2,'pagos_fijos'),('E0',3,'deudas_minimos'),('E0',4,'sobres'),('E0',5,'sin_culpa'),
 ('E1',1,'pagos_fijos'),('E1',2,'emergencia'),('E1',3,'deudas_minimos'),('E1',4,'sobres'),('E1',5,'sin_culpa'),
 ('E2',1,'pagos_fijos'),('E2',2,'deuda_objetivo'),('E2',3,'fondos'),('E2',4,'sobres'),('E2',5,'sin_culpa'),
 ('E3',1,'futuro'),('E3',2,'pagos_fijos'),('E3',3,'emergencia'),('E3',4,'fondos'),('E3',5,'sin_culpa'),
 ('E4',1,'futuro'),('E4',2,'pagos_fijos'),('E4',3,'fondos'),('E4',4,'sobres'),('E4',5,'sin_culpa'),
 ('E5',1,'futuro'),('E5',2,'pagos_fijos'),('E5',3,'fondos'),('E5',4,'sobres'),('E5',5,'sin_culpa');

INSERT INTO ref.regla_metodo(codigo,enunciado,nivel_precedencia,procesos,fuente_codigo,estado) VALUES
 ('R01','Asignación real solo con dinero recibido; el plan proyectado no mueve saldos',2,'{P2,P3}','YNAB','ajustada'),
 ('R02','Con Por asignar > 0 no se proponen gastos nuevos',5,'{P3,P5}','YNAB','ajustada'),
 ('R03','Aporte = (monto − saldo) / meses restantes',5,'{S3,P2}','YNAB','ajustada'),
 ('R04','Distribución en el orden de destinos de la etapa',5,'{P3}','SETHI','ajustada'),
 ('R05','En E0, Cuatro Paredes antes que cualquier destino',3,'{P2,P3}','RAMSEY','vigente'),
 ('R06','Esenciales > 50% → rojo',5,'{P2,P7}','WARREN','vigente'),
 ('R07','Futuro < 20% → amarillo (E0–E2: mínimo de la etapa)',5,'{P2,P7}','WARREN','ajustada'),
 ('R08','Fijos nuevos o en UF con holgura 15% el primer mes',5,'{P2}','COMPAS','vigente'),
 ('R09','Ritmo > 1,1 en sobre variable → RitmoExcedido',6,'{P5}','COMPAS','ajustada'),
 ('R10','Sobre negativo → N1; tomar de Futuro exige doble firma',4,'{P6}','YNAB','ajustada'),
 ('R11','Gasto en sobre cerrado se imputa y abre N1',2,'{P4}','COMPAS','ajustada'),
 ('R12','Balance mensual proyectado < 0 → N2',5,'{P5,P6}','COMPAS','vigente'),
 ('R13','Emergencia usada se repone antes que Futuro de largo plazo',3,'{P3}','RAMSEY','ajustada'),
 ('R14','N3 por balance < 0 dos meses, esenciales > 50% en 2 cierres o RCI alta',5,'{P6}','BCCH','ajustada'),
 ('R15','Reinicio N4 en fecha simbólica ≤ 15 días',5,'{P6}','COMPAS','ajustada'),
 ('R16','Mensajes sin culpa',6,'{Todos}','KAKEIBO','vigente'),
 ('R17','Confirmación con intención inferida, editable',6,'{P4}','KAKEIBO','ajustada'),
 ('R18','Costo en horas de vida = monto / salario real por hora',6,'{P4,P7}','YMOYL','vigente'),
 ('R19','Valoración +/0/− y preguntas Kakeibo en el cierre',5,'{P7}','KAKEIBO','vigente'),
 ('R20','Arrastre: positivo al mismo sobre; negativo descuenta Por asignar',5,'{P7}','YNAB','ajustada'),
 ('R21','Bola de nieve vs avalancha con costo comparado; elige el hogar',4,'{S2}','RAMSEY','vigente'),
 ('R22','Parte de cada reajuste va a Futuro',4,'{P3}','SMART','vigente'),
 ('R23','IA propone avance/retroceso de etapa; administradores confirman',4,'{P7}','COMPAS','ajustada'),
 ('R24','UF al valor del día (corte 09:00); sin dato → último valor + alerta',2,'{S4}','COMPAS','ajustada'),
 ('R25','Datos de menores solo a administradores, con consentimiento parental',1,'{S5}','COMPAS','vigente'),
 ('R26','Compra en N cuotas = Deuda con cuotas preasignadas',2,'{P4,S2}','COMPAS','ajustada'),
 ('R27','Pago de tarjeta = transferencia a pasivo, no gasto',2,'{P4,S1}','COMPAS','nueva'),
 ('R28','Transferencia entre cuentas del hogar no es ingreso ni gasto',2,'{P4,S1}','COMPAS','nueva'),
 ('R29','Reembolso vuelve al sobre original',2,'{P4}','COMPAS','nueva'),
 ('R30','Gasto compartido: parte propia al sobre, resto a Por cobrar',2,'{P4}','COMPAS','nueva'),
 ('R31','Efectivo como cuenta billetera conciliada semanalmente',2,'{S1}','COMPAS','nueva'),
 ('R32','Moneda extranjera a CLP con tipo de cambio del día',2,'{P4}','COMPAS','nueva'),
 ('R33','Ingreso real ±5% del proyectado → P2-A',5,'{P3}','COMPAS','nueva'),
 ('R34','Conciliación semanal obligatoria; mensual con diferencia exige ajuste',2,'{P7,S1}','COMPAS','nueva'),
 ('R35','Monto igual, fecha ±2 días y mismo medio → DuplicadoCandidato',2,'{P4}','COMPAS','nueva'),
 ('R36','Inferencia IA < 0,8 → por confirmar; nunca imputa sola a Futuro o deuda',2,'{P4}','COMPAS','nueva'),
 ('R37','Retiro de Futuro o emergencia requiere doble firma',3,'{P6}','COMPAS','nueva'),
 ('R38','Reasignación N1 bajo umbral se autoaprueba',4,'{P6}','COMPAS','nueva'),
 ('R39','A sin respuesta en 48 h → decide el suplente',4,'{Todos}','COMPAS','nueva'),
 ('R40','Máximo 3 alertas por persona al día',6,'{P5}','COMPAS','nueva');

INSERT INTO ref.definicion_kpi(codigo,nombre,grupo,formula,unidad,meta,en_mvp,fuente_codigo) VALUES
 ('K1','Tasa de ahorro','salud','asignado a Futuro / ingreso del mes','%','≥ mínimo de la etapa',true,'WARREN'),
 ('K2','Meses de reserva','salud','saldo emergencia / esenciales mensuales','meses','≥ 3',true,'RAMSEY'),
 ('K3','RCI','salud','servicio de deuda / ingreso','%','≤ 25% sin hipotecario',true,'BCCH'),
 ('K4','Esenciales / ingreso','salud','bloque Esenciales / ingreso','%','≤ 50%',true,'WARREN'),
 ('K5','Vivienda / ingreso','salud','vivienda / ingreso','%','≤ 30%',false,'WARREN'),
 ('K6','Balance mensual','salud','ingresos − gastos confirmados','CLP','≥ 0',true,'COMPAS'),
 ('K7','Edad del dinero','salud','días promedio entre ingreso y gasto','días','≥ 30',false,'YNAB'),
 ('K8','Índice de acumulación','salud','patrimonio / (edad × ingreso anual / 10)','razón','≥ 1',false,'STANLEY'),
 ('K9','Punto de cruce','salud','renta de inversiones / gasto mensual','%','100%',false,'YMOYL'),
 ('K10','Salario real por hora','salud','(ingreso − costos del trabajo) / horas','CLP/h',NULL,false,'YMOYL'),
 ('ICF','Índice Compás','compuesto','ponderación 0–100 adaptada de FinHealth','puntos','≥ 70',true,'FINHEALTH'),
 ('KP1','Cobertura de captura','proceso','movimientos capturados / conciliados','%','≥ 90%',true,'COMPAS'),
 ('KP2','Tiempo de captura','proceso','mediana segundos por captura','s','≤ 10',true,'COMPAS'),
 ('KP3','Plan a tiempo','proceso','presupuesto aprobado antes del día 1','sí/no','sí',true,'COMPAS'),
 ('KP4','Rituales cumplidos','proceso','cierres hechos / programados','%','≥ 90%',true,'COMPAS'),
 ('KP5','Días para retomar','proceso','días entre desvío y retorno','días','≤ 7',true,'COMPAS'),
 ('KP6','Aceptación de recomendaciones','proceso','aceptadas / decididas','%',NULL,true,'COMPAS');

INSERT INTO ref.categoria_plantilla VALUES
 ('alimentacion','Alimentación','ESENCIALES','variable',true,'supervivencia'),
 ('vivienda','Arriendo o dividendo','ESENCIALES','fijo',true,'supervivencia'),
 ('servicios','Luz, agua, gas, internet','ESENCIALES','fijo',true,'supervivencia'),
 ('transporte','Transporte','ESENCIALES','variable',true,'supervivencia'),
 ('salud','Salud e isapre/fonasa','ESENCIALES','fijo',false,'supervivencia'),
 ('educacion','Educación','ESENCIALES','fijo',false,'cultura'),
 ('emergencia','Fondo de emergencia','FUTURO','emergencia',false,NULL),
 ('futuro','Ahorro e inversión','FUTURO','futuro',false,NULL),
 ('deudas','Pago de deudas','FUTURO','cuota',false,NULL),
 ('gastos_anuales','Gastos anuales prorrateados','ESENCIALES','fondo',false,NULL),
 ('ocio','Ocio y salidas','VIDA','variable',false,'deseo'),
 ('sin_culpa','Sin culpa','VIDA','sin_culpa',false,'deseo'),
 ('mesada','Mesada','VIDA','mesada',false,NULL);
COMMIT;
