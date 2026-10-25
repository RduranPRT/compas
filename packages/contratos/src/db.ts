
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "app": {
          Tables: {
            "membresia": {
                  Row: {
                    "acceso_vence_en": string | null,"activo": boolean,"hogar_id": string,"integrante_id": string,"rol": Database["gob"]['Enums']["rol_integrante"],"usuario_auth_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acceso_vence_en"?: string | null,"activo": boolean,"hogar_id": string,"integrante_id": string,"rol": Database["gob"]['Enums']["rol_integrante"],"usuario_auth_id"?: string | null
                  }
                  Update: {
                    "acceso_vence_en"?: string | null,"activo"?: boolean,"hogar_id"?: string,"integrante_id"?: string,"rol"?: Database["gob"]['Enums']["rol_integrante"],"usuario_auth_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "abrir_periodo":
{ Args: { "p_periodo": string }; Returns: number
                           },
"aceptar_invitacion":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"activar_acuerdo":
{ Args: { "p_acuerdo": string }; Returns: string
                           },
"actualizar_linea_plan":
{ Args: { "p_monto": number,"p_presupuesto": string,"p_sobre": string }; Returns: undefined
                           },
"admins":
{ Args: { "p_hogar": string }; Returns: string[]
                           },
"anular_borrado_hogar":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"aplicar_acuerdo":
{ Args: { "p_solicitud": string }; Returns: undefined
                           },
"aplicar_ajuste_plan":
{ Args: { "p_solicitud": string }; Returns: undefined
                           },
"aplicar_borrado_hogar":
{ Args: { "p_solicitud": string }; Returns: undefined
                           },
"aplicar_etapa":
{ Args: { "p_solicitud": string }; Returns: undefined
                           },
"aplicar_plantilla_categorias":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"aplicar_presupuesto":
{ Args: { "p_solicitud": string }; Returns: undefined
                           },
"aplicar_reasignacion":
{ Args: { "p_solicitud": string }; Returns: undefined
                           },
"aplicar_retiro_futuro":
{ Args: { "p_solicitud": string }; Returns: undefined
                           },
"asegurar_mes":
{ Args: { "p_mes": string }; Returns: string
                           },
"balance_proyectado":
{ Args: { "p_hoy": string,"p_periodo": string }; Returns: number
                           },
"cerrar_importaciones_revisadas":
{ Args: { "p_hogar": string }; Returns: undefined
                           },
"cerrar_mes":
{ Args: { "p_justificacion"?: string,"p_kpis": Json,"p_periodo": string,"p_resumen"?: string }; Returns: Json
                           },
"cerrar_n1_cubiertos":
{ Args: { "p_hogar": string }; Returns: number
                           },
"cerrar_semana":
{ Args: { "p_fecha_corte": string,"p_saldos": Json }; Returns: Json
                           },
"clasificar_comercio":
{ Args: { "p_categoria": string,"p_comercio": string,"p_importacion": string,"p_integrante"?: string,"p_intencion"?: Database["fin"]['Enums']["intencion"] }; Returns: Json
                           },
"conciliar_cuenta":
{ Args: { "p_cuenta": string,"p_fecha_corte": string,"p_motivo"?: string,"p_saldo_real": number,"p_tipo": string }; Returns: Json
                           },
"confirmar_distribucion":
{ Args: { "p_asignaciones": Json,"p_ingreso": string }; Returns: Json
                           },
"confirmar_interno":
{ Args: { "p_mov": string }; Returns: undefined
                           },
"confirmar_movimiento":
{ Args: { "p_intencion"?: Database["fin"]['Enums']["intencion"],"p_mov": string,"p_sobre"?: string }; Returns: undefined
                           },
"consentimiento_vigente":
{ Args: { "p_finalidad": Database["gob"]['Enums']["finalidad_consent"],"p_integrante": string }; Returns: boolean
                           },
"control_diario":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"control_hogar":
{ Args: { "p_hogar": string,"p_hoy"?: string }; Returns: Json
                           },
"crear_hogar":
{ Args: { "p_nombre": string,"p_nombre_hogar": string }; Returns: string
                           },
"crear_periodo":
{ Args: { "p_mes": string }; Returns: string
                           },
"crear_sobres_periodo":
{ Args: { "p_periodo": string }; Returns: number
                           },
"crear_sobres_periodo_interno":
{ Args: { "p_periodo": string }; Returns: number
                           },
"crear_solicitud":
{ Args: { "p_aprobador": string,"p_firmas": number,"p_objeto": string,"p_regla": string,"p_tabla": string,"p_tipo": Database["gob"]['Enums']["tipo_solicitud"] }; Returns: string
                           },
"cuenta_del_hogar":
{ Args: { "p_cuenta": string }; Returns: Database["fin"]['Tables']["cuenta"]['Row']
                          SetofOptions: {
        from: "*"
        to: "cuenta"
        isOneToOne: true
        isSetofReturn: false
      } },
"decidir_perfil":
{ Args: { "p_aceptar": boolean,"p_perfil": string }; Returns: undefined
                           },
"descartar_movimiento":
{ Args: { "p_mov": string }; Returns: undefined
                           },
"emitir_alerta":
{ Args: { "p_clave": string,"p_dato": Json,"p_destinatario": string,"p_hogar": string,"p_mensaje": string,"p_regla": string,"p_severidad": Database["med"]['Enums']["severidad"],"p_sobre": string,"p_tipo": string }; Returns: string
                           },
"emitir_evento":
{ Args: { "p_actor": string,"p_carga": Json,"p_hogar": string,"p_tipo": string }; Returns: undefined
                           },
"enviar_plan":
{ Args: { "p_presupuesto": string }; Returns: string
                           },
"es_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"exigir_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"exigir_base_cero":
{ Args: { "p_presupuesto": string }; Returns: undefined
                           },
"exigir_integrante":
{ Args: Record<PropertyKey, never>; Returns: Database["gob"]['Enums']["rol_integrante"]
                           },
"guardar_borrador_plan":
{ Args: { "p_generado_por"?: "humano"|"ia"|"sistema"|"externo","p_ingreso": number,"p_lineas": Json,"p_mes": string,"p_motivo"?: string }; Returns: string
                           },
"guardar_perfil":
{ Args: { "p_desde": string,"p_etapa": string,"p_hasta": string,"p_modelo"?: string,"p_perfil": Json,"p_retro": Json }; Returns: string
                           },
"guardar_sugerencias":
{ Args: { "p_items": Json }; Returns: number
                           },
"hogar_actual":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"hogar_solicitado":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"importar_cartola":
{ Args: { "p_archivo": string,"p_cuenta": string,"p_formato": string,"p_lector": string,"p_lineas": Json,"p_sha256": string }; Returns: Json
                           },
"imputar":
{ Args: { "p_actor": "humano"|"ia"|"sistema"|"externo","p_mov": string,"p_sobre": string }; Returns: undefined
                           },
"iniciar_cierre_mes":
{ Args: { "p_periodo": string }; Returns: string
                           },
"inicio_piloto":
{ Args: { "p_hogar": string }; Returns: string
                           },
"integrante_actual":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"invitar_integrante":
{ Args: { "p_correo": string,"p_nombre": string,"p_rol": Database["gob"]['Enums']["rol_integrante"] }; Returns: string
                           },
"jwt_sub":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"marcar_avisos_leidos":
{ Args: { "p_ids": (string)[] }; Returns: number
                           },
"marcar_duplicados":
{ Args: { "p_mov": string }; Returns: number
                           },
"marcar_transferencia":
{ Args: { "p_hecha": boolean,"p_transferencia": string }; Returns: undefined
                           },
"mes_primer_plan":
{ Args: { "p_hogar": string }; Returns: string
                           },
"otro_admin":
{ Args: { "p_hogar": string,"p_yo": string }; Returns: string
                           },
"pago_tarjeta_de_linea":
{ Args: { "p_fecha": string,"p_hash": string,"p_hogar": string,"p_imp": string,"p_monto": number,"p_origen": string,"p_tarjeta": string }; Returns: boolean
                           },
"parametro":
{ Args: { "p_codigo": string,"p_hogar": string }; Returns: Json
                           },
"parametro_num":
{ Args: { "p_codigo": string,"p_defecto": number,"p_hogar": string }; Returns: number
                           },
"periodo_de":
{ Args: { "p_fecha": string,"p_hogar": string }; Returns: string
                           },
"pesos":
{ Args: { "p_monto": number }; Returns: string
                           },
"pesos_n":
{ Args: { "p_monto": number }; Returns: string
                           },
"poner_vigente":
{ Args: { "p_actor": string,"p_acuerdo": string }; Returns: undefined
                           },
"presupuesto_del_hogar":
{ Args: { "p_presupuesto": string }; Returns: Database["plan"]['Tables']["presupuesto_mensual"]['Row']
                          SetofOptions: {
        from: "*"
        to: "presupuesto_mensual"
        isOneToOne: true
        isSetofReturn: false
      } },
"pronostico_mes":
{ Args: { "p_mes": string }; Returns: number
                           },
"proponer_acuerdo":
{ Args: { "p_reglas": Json,"p_urgente": boolean }; Returns: string
                           },
"proponer_etapa":
{ Args: { "p_etapa": string,"p_evidencia": Json,"p_origen"?: "humano"|"ia"|"sistema"|"externo" }; Returns: string
                           },
"puede_consentir_por":
{ Args: { "p_otorgante": string,"p_titular": string }; Returns: boolean
                           },
"purgar_hogar":
{ Args: { "p_hogar": string }; Returns: undefined
                           },
"purgar_hogares":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"reabrir_periodo":
{ Args: { "p_motivo": string,"p_periodo": string }; Returns: number
                           },
"reasignar":
{ Args: { "p_destino": string,"p_monto": number,"p_motivo"?: string,"p_origen": string }; Returns: Json
                           },
"rechazar_etapa":
{ Args: { "p_solicitud": string }; Returns: undefined
                           },
"registrar_exportacion":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"registrar_gasto":
{ Args: { "p_cliente_op": string,"p_comercio"?: string,"p_confianza"?: number,"p_cuenta": string,"p_fecha": string,"p_intencion"?: Database["fin"]['Enums']["intencion"],"p_monto": number,"p_n_cuotas"?: number,"p_nota"?: string,"p_origen"?: Database["fin"]['Enums']["origen_movimiento"],"p_sobre": string,"p_tratamiento"?: string }; Returns: Json
                           },
"registrar_ingreso":
{ Args: { "p_cliente_op": string,"p_cuenta": string,"p_descripcion"?: string,"p_es_variable"?: boolean,"p_fecha": string,"p_integrante": string,"p_monto": number,"p_para_mes_siguiente"?: boolean,"p_tipo_ingreso"?: Database["fin"]['Enums']["tipo_ingreso"] }; Returns: Json
                           },
"registrar_menor":
{ Args: { "p_nombre": string,"p_version_consentimiento": string }; Returns: string
                           },
"registrar_pago_tarjeta":
{ Args: { "p_cliente_op": string,"p_fecha": string,"p_monto": number,"p_origen": string,"p_tarjeta": string }; Returns: string
                           },
"registrar_reembolso":
{ Args: { "p_cliente_op": string,"p_fecha": string,"p_monto": number,"p_original": string }; Returns: Json
                           },
"resolver_duplicado":
{ Args: { "p_dup": string,"p_es_duplicado": boolean }; Returns: undefined
                           },
"resolver_solicitud":
{ Args: { "p_aprueba": boolean,"p_comentario"?: string,"p_solicitud": string }; Returns: Database["gob"]['Enums']["estado_solicitud"]
                           },
"revocar_consentimiento":
{ Args: { "p_finalidad": Database["gob"]['Enums']["finalidad_consent"],"p_titular"?: string }; Returns: number
                           },
"rol_actual":
{ Args: Record<PropertyKey, never>; Returns: Database["gob"]['Enums']["rol_integrante"]
                           },
"sobre_categoria":
{ Args: { "p_categoria": string,"p_integrante": string,"p_periodo": string }; Returns: string
                           },
"sobre_en_periodo":
{ Args: { "p_periodo": string,"p_sobre": string }; Returns: string
                           },
"solicitar_borrado_hogar":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"valorar":
{ Args: { "p_categoria": string,"p_cierre": string,"p_pregunta"?: string,"p_respuesta"?: string,"p_valoracion": Database["med"]['Enums']["valoracion"] }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"fin": {
          Tables: {
            "activo": {
                  Row: {
                    "hogar_id": string,"id": string,"nombre": string,"tipo": string,"valor_clp": number,"valorizado_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "hogar_id": string,"id"?: string,"nombre": string,"tipo": string,"valor_clp": number,"valorizado_en": string
                  }
                  Update: {
                    "hogar_id"?: string,"id"?: string,"nombre"?: string,"tipo"?: string,"valor_clp"?: number,"valorizado_en"?: string
                  }
                  Relationships: [
                    
                  ]
                },"conciliacion": {
                  Row: {
                    "ajuste_movimiento_id": string | null,"cuenta_id": string,"diferencia": number | null,"fecha_corte": string,"hogar_id": string,"id": string,"motivo": string | null,"periodo_id": string,"realizada_en": string,"realizada_por": string,"saldo_real": number,"saldo_registrado": number,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ajuste_movimiento_id"?: string | null,"cuenta_id": string,"diferencia"?: never,"fecha_corte": string,"hogar_id": string,"id"?: string,"motivo"?: string | null,"periodo_id": string,"realizada_en"?: string,"realizada_por": string,"saldo_real": number,"saldo_registrado": number,"tipo": string
                  }
                  Update: {
                    "ajuste_movimiento_id"?: string | null,"cuenta_id"?: string,"diferencia"?: never,"fecha_corte"?: string,"hogar_id"?: string,"id"?: string,"motivo"?: string | null,"periodo_id"?: string,"realizada_en"?: string,"realizada_por"?: string,"saldo_real"?: number,"saldo_registrado"?: number,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conciliacion_ajuste_movimiento_id_fkey"
      columns: ["ajuste_movimiento_id"]
isOneToOne: false
      referencedRelation: "movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conciliacion_ajuste_movimiento_id_fkey"
      columns: ["ajuste_movimiento_id"]
isOneToOne: false
      referencedRelation: "v_movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conciliacion_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "cuenta"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conciliacion_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_saldo_cuenta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "conciliacion_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_tarjeta"
      referencedColumns: ["cuenta_id"]
    }
                  ]
                },"cuenta": {
                  Row: {
                    "activa": boolean,"creado_en": string,"cupo": number | null,"dia_facturacion": number | null,"dia_pago": number | null,"es_fondo_comun": boolean,"fecha_saldo_inicial": string,"hogar_id": string,"id": string,"institucion": string | null,"moneda": Database["fin"]['Enums']["moneda"],"nombre": string,"saldo_inicial": number,"tipo": Database["fin"]['Enums']["tipo_cuenta"],"titular_id": string | null,"ultimos4": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"creado_en"?: string,"cupo"?: number | null,"dia_facturacion"?: number | null,"dia_pago"?: number | null,"es_fondo_comun"?: boolean,"fecha_saldo_inicial"?: string,"hogar_id": string,"id"?: string,"institucion"?: string | null,"moneda"?: Database["fin"]['Enums']["moneda"],"nombre": string,"saldo_inicial"?: number,"tipo": Database["fin"]['Enums']["tipo_cuenta"],"titular_id"?: string | null,"ultimos4"?: string | null
                  }
                  Update: {
                    "activa"?: boolean,"creado_en"?: string,"cupo"?: number | null,"dia_facturacion"?: number | null,"dia_pago"?: number | null,"es_fondo_comun"?: boolean,"fecha_saldo_inicial"?: string,"hogar_id"?: string,"id"?: string,"institucion"?: string | null,"moneda"?: Database["fin"]['Enums']["moneda"],"nombre"?: string,"saldo_inicial"?: number,"tipo"?: Database["fin"]['Enums']["tipo_cuenta"],"titular_id"?: string | null,"ultimos4"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"cuota_deuda": {
                  Row: {
                    "deuda_id": string,"mes_facturacion": string,"monto_clp": number,"numero": number,"pagada": boolean,"sobre_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "deuda_id": string,"mes_facturacion": string,"monto_clp": number,"numero": number,"pagada"?: boolean,"sobre_id"?: string | null
                  }
                  Update: {
                    "deuda_id"?: string,"mes_facturacion"?: string,"monto_clp"?: number,"numero"?: number,"pagada"?: boolean,"sobre_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cuota_deuda_deuda_id_fkey"
      columns: ["deuda_id"]
isOneToOne: false
      referencedRelation: "deuda"
      referencedColumns: ["id"]
    }
                  ]
                },"deuda": {
                  Row: {
                    "acreedor": string,"cae_pct": number | null,"creado_en": string,"cuenta_id": string | null,"cuota_monto": number | null,"dia_vencimiento": number | null,"es_consumo": boolean,"estado": string,"hogar_id": string,"id": string,"monto_original": number,"movimiento_origen_id": string | null,"n_cuotas": number | null,"orden_pago": number | null,"saldo_actual": number,"tasa_mensual_pct": number | null,"tipo": Database["fin"]['Enums']["tipo_deuda"]
                  }
                  ComputedFields: never
                  Insert: {
                    "acreedor": string,"cae_pct"?: number | null,"creado_en"?: string,"cuenta_id"?: string | null,"cuota_monto"?: number | null,"dia_vencimiento"?: number | null,"es_consumo"?: boolean,"estado"?: string,"hogar_id": string,"id"?: string,"monto_original": number,"movimiento_origen_id"?: string | null,"n_cuotas"?: number | null,"orden_pago"?: number | null,"saldo_actual": number,"tasa_mensual_pct"?: number | null,"tipo": Database["fin"]['Enums']["tipo_deuda"]
                  }
                  Update: {
                    "acreedor"?: string,"cae_pct"?: number | null,"creado_en"?: string,"cuenta_id"?: string | null,"cuota_monto"?: number | null,"dia_vencimiento"?: number | null,"es_consumo"?: boolean,"estado"?: string,"hogar_id"?: string,"id"?: string,"monto_original"?: number,"movimiento_origen_id"?: string | null,"n_cuotas"?: number | null,"orden_pago"?: number | null,"saldo_actual"?: number,"tasa_mensual_pct"?: number | null,"tipo"?: Database["fin"]['Enums']["tipo_deuda"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "deuda_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "cuenta"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deuda_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_saldo_cuenta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "deuda_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_tarjeta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "deuda_movimiento_origen_id_fkey"
      columns: ["movimiento_origen_id"]
isOneToOne: false
      referencedRelation: "movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deuda_movimiento_origen_id_fkey"
      columns: ["movimiento_origen_id"]
isOneToOne: false
      referencedRelation: "v_movimiento"
      referencedColumns: ["id"]
    }
                  ]
                },"duplicado_candidato": {
                  Row: {
                    "es_duplicado": boolean | null,"estado": Database["fin"]['Enums']["estado_simple"],"hogar_id": string,"id": string,"movimiento_a_id": string,"movimiento_b_id": string,"resuelto_en": string | null,"resuelto_por": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "es_duplicado"?: boolean | null,"estado"?: Database["fin"]['Enums']["estado_simple"],"hogar_id": string,"id"?: string,"movimiento_a_id": string,"movimiento_b_id": string,"resuelto_en"?: string | null,"resuelto_por"?: string | null
                  }
                  Update: {
                    "es_duplicado"?: boolean | null,"estado"?: Database["fin"]['Enums']["estado_simple"],"hogar_id"?: string,"id"?: string,"movimiento_a_id"?: string,"movimiento_b_id"?: string,"resuelto_en"?: string | null,"resuelto_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "duplicado_candidato_movimiento_a_id_fkey"
      columns: ["movimiento_a_id"]
isOneToOne: false
      referencedRelation: "movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "duplicado_candidato_movimiento_a_id_fkey"
      columns: ["movimiento_a_id"]
isOneToOne: false
      referencedRelation: "v_movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "duplicado_candidato_movimiento_b_id_fkey"
      columns: ["movimiento_b_id"]
isOneToOne: false
      referencedRelation: "movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "duplicado_candidato_movimiento_b_id_fkey"
      columns: ["movimiento_b_id"]
isOneToOne: false
      referencedRelation: "v_movimiento"
      referencedColumns: ["id"]
    }
                  ]
                },"evidencia": {
                  Row: {
                    "creado_en": string,"expira_en": string | null,"hogar_id": string,"id": string,"movimiento_id": string | null,"sha256": string,"storage_uri": string,"tipo": Database["fin"]['Enums']["tipo_evidencia"]
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"expira_en"?: string | null,"hogar_id": string,"id"?: string,"movimiento_id"?: string | null,"sha256": string,"storage_uri": string,"tipo": Database["fin"]['Enums']["tipo_evidencia"]
                  }
                  Update: {
                    "creado_en"?: string,"expira_en"?: string | null,"hogar_id"?: string,"id"?: string,"movimiento_id"?: string | null,"sha256"?: string,"storage_uri"?: string,"tipo"?: Database["fin"]['Enums']["tipo_evidencia"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "evidencia_movimiento_id_fkey"
      columns: ["movimiento_id"]
isOneToOne: false
      referencedRelation: "movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evidencia_movimiento_id_fkey"
      columns: ["movimiento_id"]
isOneToOne: false
      referencedRelation: "v_movimiento"
      referencedColumns: ["id"]
    }
                  ]
                },"importacion": {
                  Row: {
                    "archivo_nombre": string,"creado_en": string,"cuenta_id": string,"desde": string | null,"error": string | null,"estado": string,"expira_en": string,"formato": string,"hasta": string | null,"hogar_id": string,"id": string,"institucion": string | null,"lector": string | null,"n_duplicados": number | null,"n_filas": number | null,"n_historicos": number | null,"n_movimientos": number | null,"purgada_en": string | null,"sha256": string,"storage_uri": string | null,"subida_por": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archivo_nombre": string,"creado_en"?: string,"cuenta_id": string,"desde"?: string | null,"error"?: string | null,"estado"?: string,"expira_en"?: string,"formato": string,"hasta"?: string | null,"hogar_id": string,"id"?: string,"institucion"?: string | null,"lector"?: string | null,"n_duplicados"?: number | null,"n_filas"?: number | null,"n_historicos"?: number | null,"n_movimientos"?: number | null,"purgada_en"?: string | null,"sha256": string,"storage_uri"?: string | null,"subida_por": string
                  }
                  Update: {
                    "archivo_nombre"?: string,"creado_en"?: string,"cuenta_id"?: string,"desde"?: string | null,"error"?: string | null,"estado"?: string,"expira_en"?: string,"formato"?: string,"hasta"?: string | null,"hogar_id"?: string,"id"?: string,"institucion"?: string | null,"lector"?: string | null,"n_duplicados"?: number | null,"n_filas"?: number | null,"n_historicos"?: number | null,"n_movimientos"?: number | null,"purgada_en"?: string | null,"sha256"?: string,"storage_uri"?: string | null,"subida_por"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "importacion_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "cuenta"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "importacion_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_saldo_cuenta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "importacion_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_tarjeta"
      referencedColumns: ["cuenta_id"]
    }
                  ]
                },"imputacion": {
                  Row: {
                    "creada_por_tipo": "humano"|"ia"|"sistema"|"externo","creado_en": string,"hogar_id": string,"id": string,"monto_clp": number,"movimiento_id": string,"sobre_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creada_por_tipo"?: "humano"|"ia"|"sistema"|"externo","creado_en"?: string,"hogar_id": string,"id"?: string,"monto_clp": number,"movimiento_id": string,"sobre_id": string
                  }
                  Update: {
                    "creada_por_tipo"?: "humano"|"ia"|"sistema"|"externo","creado_en"?: string,"hogar_id"?: string,"id"?: string,"monto_clp"?: number,"movimiento_id"?: string,"sobre_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "imputacion_movimiento_id_fkey"
      columns: ["movimiento_id"]
isOneToOne: false
      referencedRelation: "movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "imputacion_movimiento_id_fkey"
      columns: ["movimiento_id"]
isOneToOne: false
      referencedRelation: "v_movimiento"
      referencedColumns: ["id"]
    }
                  ]
                },"ingreso": {
                  Row: {
                    "diferencia_pct": number | null,"es_variable": boolean,"ingreso_esperado_id": string | null,"integrante_id": string | null,"movimiento_id": string,"para_mes_siguiente": boolean,"tipo_ingreso": Database["fin"]['Enums']["tipo_ingreso"]
                  }
                  ComputedFields: never
                  Insert: {
                    "diferencia_pct"?: number | null,"es_variable"?: boolean,"ingreso_esperado_id"?: string | null,"integrante_id"?: string | null,"movimiento_id": string,"para_mes_siguiente"?: boolean,"tipo_ingreso": Database["fin"]['Enums']["tipo_ingreso"]
                  }
                  Update: {
                    "diferencia_pct"?: number | null,"es_variable"?: boolean,"ingreso_esperado_id"?: string | null,"integrante_id"?: string | null,"movimiento_id"?: string,"para_mes_siguiente"?: boolean,"tipo_ingreso"?: Database["fin"]['Enums']["tipo_ingreso"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingreso_movimiento_id_fkey"
      columns: ["movimiento_id"]
isOneToOne: true
      referencedRelation: "movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingreso_movimiento_id_fkey"
      columns: ["movimiento_id"]
isOneToOne: true
      referencedRelation: "v_movimiento"
      referencedColumns: ["id"]
    }
                  ]
                },"movimiento": {
                  Row: {
                    "actualizado_en": string,"calce_importacion_id": string | null,"categoria_sugerida_id": string | null,"cliente_op_id": string | null,"comercio": string | null,"confianza_ia": number | null,"confirmado_en": string | null,"confirmado_por": string | null,"creado_en": string,"cuenta_id": string,"estado": Database["fin"]['Enums']["estado_movimiento"],"fecha_contable": string,"hash_dedup": string | null,"hash_linea": string | null,"hogar_id": string,"id": string,"importacion_id": string | null,"intencion": Database["fin"]['Enums']["intencion"] | null,"moneda_original": Database["fin"]['Enums']["moneda"],"monto_clp": number,"monto_original": number | null,"movimiento_original_id": string | null,"n_cuotas": number | null,"nota": string | null,"origen": Database["fin"]['Enums']["origen_movimiento"],"periodo_id": string,"registrado_por": string | null,"registrado_por_tipo": "humano"|"ia"|"sistema"|"externo","sentido": string | null,"tipo": Database["fin"]['Enums']["tipo_movimiento"],"tratamiento_cuotas": string | null,"valor_conversion": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"calce_importacion_id"?: string | null,"categoria_sugerida_id"?: string | null,"cliente_op_id"?: string | null,"comercio"?: string | null,"confianza_ia"?: number | null,"confirmado_en"?: string | null,"confirmado_por"?: string | null,"creado_en"?: string,"cuenta_id": string,"estado"?: Database["fin"]['Enums']["estado_movimiento"],"fecha_contable": string,"hash_dedup"?: never,"hash_linea"?: string | null,"hogar_id": string,"id"?: string,"importacion_id"?: string | null,"intencion"?: Database["fin"]['Enums']["intencion"] | null,"moneda_original"?: Database["fin"]['Enums']["moneda"],"monto_clp": number,"monto_original"?: number | null,"movimiento_original_id"?: string | null,"n_cuotas"?: number | null,"nota"?: string | null,"origen": Database["fin"]['Enums']["origen_movimiento"],"periodo_id": string,"registrado_por"?: string | null,"registrado_por_tipo"?: "humano"|"ia"|"sistema"|"externo","sentido"?: string | null,"tipo": Database["fin"]['Enums']["tipo_movimiento"],"tratamiento_cuotas"?: string | null,"valor_conversion"?: number | null
                  }
                  Update: {
                    "actualizado_en"?: string,"calce_importacion_id"?: string | null,"categoria_sugerida_id"?: string | null,"cliente_op_id"?: string | null,"comercio"?: string | null,"confianza_ia"?: number | null,"confirmado_en"?: string | null,"confirmado_por"?: string | null,"creado_en"?: string,"cuenta_id"?: string,"estado"?: Database["fin"]['Enums']["estado_movimiento"],"fecha_contable"?: string,"hash_dedup"?: never,"hash_linea"?: string | null,"hogar_id"?: string,"id"?: string,"importacion_id"?: string | null,"intencion"?: Database["fin"]['Enums']["intencion"] | null,"moneda_original"?: Database["fin"]['Enums']["moneda"],"monto_clp"?: number,"monto_original"?: number | null,"movimiento_original_id"?: string | null,"n_cuotas"?: number | null,"nota"?: string | null,"origen"?: Database["fin"]['Enums']["origen_movimiento"],"periodo_id"?: string,"registrado_por"?: string | null,"registrado_por_tipo"?: "humano"|"ia"|"sistema"|"externo","sentido"?: string | null,"tipo"?: Database["fin"]['Enums']["tipo_movimiento"],"tratamiento_cuotas"?: string | null,"valor_conversion"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "movimiento_calce_importacion_id_fkey"
      columns: ["calce_importacion_id"]
isOneToOne: false
      referencedRelation: "importacion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_calce_importacion_id_fkey"
      columns: ["calce_importacion_id"]
isOneToOne: false
      referencedRelation: "v_importacion_por_purgar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "cuenta"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_saldo_cuenta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "movimiento_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_tarjeta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "movimiento_importacion_id_fkey"
      columns: ["importacion_id"]
isOneToOne: false
      referencedRelation: "importacion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_importacion_id_fkey"
      columns: ["importacion_id"]
isOneToOne: false
      referencedRelation: "v_importacion_por_purgar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_movimiento_original_id_fkey"
      columns: ["movimiento_original_id"]
isOneToOne: false
      referencedRelation: "movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_movimiento_original_id_fkey"
      columns: ["movimiento_original_id"]
isOneToOne: false
      referencedRelation: "v_movimiento"
      referencedColumns: ["id"]
    }
                  ]
                },"movimiento_historico": {
                  Row: {
                    "bloque_codigo": string | null,"categoria_id": string | null,"clase": string | null,"comercio": string | null,"confianza_ia": number | null,"creado_en": string,"cuenta_id": string,"es_recurrente": boolean | null,"fecha": string,"glosa": string,"hash_linea": string,"hogar_id": string,"id": string,"importacion_id": string,"intencion": Database["fin"]['Enums']["intencion"] | null,"monto_clp": number,"revisado": boolean,"sentido": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bloque_codigo"?: string | null,"categoria_id"?: string | null,"clase"?: string | null,"comercio"?: string | null,"confianza_ia"?: number | null,"creado_en"?: string,"cuenta_id": string,"es_recurrente"?: boolean | null,"fecha": string,"glosa": string,"hash_linea": string,"hogar_id": string,"id"?: string,"importacion_id": string,"intencion"?: Database["fin"]['Enums']["intencion"] | null,"monto_clp": number,"revisado"?: boolean,"sentido": string
                  }
                  Update: {
                    "bloque_codigo"?: string | null,"categoria_id"?: string | null,"clase"?: string | null,"comercio"?: string | null,"confianza_ia"?: number | null,"creado_en"?: string,"cuenta_id"?: string,"es_recurrente"?: boolean | null,"fecha"?: string,"glosa"?: string,"hash_linea"?: string,"hogar_id"?: string,"id"?: string,"importacion_id"?: string,"intencion"?: Database["fin"]['Enums']["intencion"] | null,"monto_clp"?: number,"revisado"?: boolean,"sentido"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "movimiento_historico_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "cuenta"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_historico_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_saldo_cuenta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "movimiento_historico_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_tarjeta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "movimiento_historico_importacion_id_fkey"
      columns: ["importacion_id"]
isOneToOne: false
      referencedRelation: "importacion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_historico_importacion_id_fkey"
      columns: ["importacion_id"]
isOneToOne: false
      referencedRelation: "v_importacion_por_purgar"
      referencedColumns: ["id"]
    }
                  ]
                },"por_cobrar": {
                  Row: {
                    "creado_en": string,"deudor": string,"estado": Database["fin"]['Enums']["estado_simple"],"hogar_id": string,"id": string,"monto_clp": number,"movimiento_origen_id": string,"movimiento_pago_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"deudor": string,"estado"?: Database["fin"]['Enums']["estado_simple"],"hogar_id": string,"id"?: string,"monto_clp": number,"movimiento_origen_id": string,"movimiento_pago_id"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"deudor"?: string,"estado"?: Database["fin"]['Enums']["estado_simple"],"hogar_id"?: string,"id"?: string,"monto_clp"?: number,"movimiento_origen_id"?: string,"movimiento_pago_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "por_cobrar_movimiento_origen_id_fkey"
      columns: ["movimiento_origen_id"]
isOneToOne: false
      referencedRelation: "movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "por_cobrar_movimiento_origen_id_fkey"
      columns: ["movimiento_origen_id"]
isOneToOne: false
      referencedRelation: "v_movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "por_cobrar_movimiento_pago_id_fkey"
      columns: ["movimiento_pago_id"]
isOneToOne: false
      referencedRelation: "movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "por_cobrar_movimiento_pago_id_fkey"
      columns: ["movimiento_pago_id"]
isOneToOne: false
      referencedRelation: "v_movimiento"
      referencedColumns: ["id"]
    }
                  ]
                },"regla_comercio": {
                  Row: {
                    "categoria_id": string,"creada_por": string,"creado_en": string,"hogar_id": string,"id": string,"integrante_id": string | null,"intencion": Database["fin"]['Enums']["intencion"] | null,"patron": string,"veces_usada": number
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria_id": string,"creada_por": string,"creado_en"?: string,"hogar_id": string,"id"?: string,"integrante_id"?: string | null,"intencion"?: Database["fin"]['Enums']["intencion"] | null,"patron": string,"veces_usada"?: number
                  }
                  Update: {
                    "categoria_id"?: string,"creada_por"?: string,"creado_en"?: string,"hogar_id"?: string,"id"?: string,"integrante_id"?: string | null,"intencion"?: Database["fin"]['Enums']["intencion"] | null,"patron"?: string,"veces_usada"?: number
                  }
                  Relationships: [
                    
                  ]
                },"transferencia": {
                  Row: {
                    "cliente_op_id": string | null,"creado_en": string,"cuenta_destino_id": string | null,"cuenta_origen_id": string,"estado": Database["fin"]['Enums']["estado_transferencia"],"fecha": string,"hash_linea": string | null,"hecha_en": string | null,"hecha_por": string | null,"hogar_id": string,"id": string,"importacion_id": string | null,"monto_clp": number,"sobre_id": string | null,"tipo": Database["fin"]['Enums']["tipo_transferencia"],"vence_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_op_id"?: string | null,"creado_en"?: string,"cuenta_destino_id"?: string | null,"cuenta_origen_id": string,"estado"?: Database["fin"]['Enums']["estado_transferencia"],"fecha": string,"hash_linea"?: string | null,"hecha_en"?: string | null,"hecha_por"?: string | null,"hogar_id": string,"id"?: string,"importacion_id"?: string | null,"monto_clp": number,"sobre_id"?: string | null,"tipo": Database["fin"]['Enums']["tipo_transferencia"],"vence_en"?: string | null
                  }
                  Update: {
                    "cliente_op_id"?: string | null,"creado_en"?: string,"cuenta_destino_id"?: string | null,"cuenta_origen_id"?: string,"estado"?: Database["fin"]['Enums']["estado_transferencia"],"fecha"?: string,"hash_linea"?: string | null,"hecha_en"?: string | null,"hecha_por"?: string | null,"hogar_id"?: string,"id"?: string,"importacion_id"?: string | null,"monto_clp"?: number,"sobre_id"?: string | null,"tipo"?: Database["fin"]['Enums']["tipo_transferencia"],"vence_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "transferencia_cuenta_destino_id_fkey"
      columns: ["cuenta_destino_id"]
isOneToOne: false
      referencedRelation: "cuenta"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transferencia_cuenta_destino_id_fkey"
      columns: ["cuenta_destino_id"]
isOneToOne: false
      referencedRelation: "v_saldo_cuenta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "transferencia_cuenta_destino_id_fkey"
      columns: ["cuenta_destino_id"]
isOneToOne: false
      referencedRelation: "v_tarjeta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "transferencia_cuenta_origen_id_fkey"
      columns: ["cuenta_origen_id"]
isOneToOne: false
      referencedRelation: "cuenta"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transferencia_cuenta_origen_id_fkey"
      columns: ["cuenta_origen_id"]
isOneToOne: false
      referencedRelation: "v_saldo_cuenta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "transferencia_cuenta_origen_id_fkey"
      columns: ["cuenta_origen_id"]
isOneToOne: false
      referencedRelation: "v_tarjeta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "transferencia_importacion_id_fkey"
      columns: ["importacion_id"]
isOneToOne: false
      referencedRelation: "importacion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transferencia_importacion_id_fkey"
      columns: ["importacion_id"]
isOneToOne: false
      referencedRelation: "v_importacion_por_purgar"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_importacion_por_purgar": {
                  Row: {
                    "expira_en": string,"hogar_id": string,"id": string,"storage_uri": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "expira_en"?: string | null,"hogar_id"?: string | null,"id"?: string | null,"storage_uri"?: string | null
                         }
                        Update: {
                           "expira_en"?: string | null,"hogar_id"?: string | null,"id"?: string | null,"storage_uri"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"v_movimiento": {
                  Row: {
                    "bloque_codigo": string | null,"categoria_id": string | null,"comercio": string | null,"confianza_ia": number | null,"creado_en": string,"cuenta": string,"cuenta_id": string,"estado": Database["fin"]['Enums']["estado_movimiento"],"fecha_contable": string,"hogar_id": string,"id": string,"importacion_id": string | null,"intencion": Database["fin"]['Enums']["intencion"] | null,"monto_clp": number,"movimiento_original_id": string | null,"n_cuotas": number | null,"nota": string | null,"origen": Database["fin"]['Enums']["origen_movimiento"],"periodo_id": string,"registrado_por": string | null,"sobre": string | null,"sobre_id": string | null,"tipo": Database["fin"]['Enums']["tipo_movimiento"],"tipo_cuenta": Database["fin"]['Enums']["tipo_cuenta"],"tratamiento_cuotas": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "movimiento_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "cuenta"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_saldo_cuenta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "movimiento_cuenta_id_fkey"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "v_tarjeta"
      referencedColumns: ["cuenta_id"]
    },{
      foreignKeyName: "movimiento_importacion_id_fkey"
      columns: ["importacion_id"]
isOneToOne: false
      referencedRelation: "importacion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_importacion_id_fkey"
      columns: ["importacion_id"]
isOneToOne: false
      referencedRelation: "v_importacion_por_purgar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_movimiento_original_id_fkey"
      columns: ["movimiento_original_id"]
isOneToOne: false
      referencedRelation: "movimiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimiento_movimiento_original_id_fkey"
      columns: ["movimiento_original_id"]
isOneToOne: false
      referencedRelation: "v_movimiento"
      referencedColumns: ["id"]
    }
                  ]
                },"v_revision_comercio": {
                  Row: {
                    "categoria_sugerida_id": string | null,"comercio": string | null,"confianza": number | null,"hogar_id": string | null,"importacion_id": string | null,"monto": number | null,"n": number | null,"origen": string | null,"revisado": boolean | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_saldo_cuenta": {
                  Row: {
                    "activa": boolean,"conciliada_hasta": string | null,"cuenta_id": string,"fecha_saldo_inicial": string,"hogar_id": string,"institucion": string | null,"nombre": string,"saldo": number | null,"saldo_inicial": number,"tipo": Database["fin"]['Enums']["tipo_cuenta"],"ultimos4": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "activa"?: boolean | null,"conciliada_hasta"?: never,"cuenta_id"?: string | null,"fecha_saldo_inicial"?: string | null,"hogar_id"?: string | null,"institucion"?: string | null,"nombre"?: string | null,"saldo"?: never,"saldo_inicial"?: number | null,"tipo"?: Database["fin"]['Enums']["tipo_cuenta"] | null,"ultimos4"?: string | null
                         }
                        Update: {
                           "activa"?: boolean | null,"conciliada_hasta"?: never,"cuenta_id"?: string | null,"fecha_saldo_inicial"?: string | null,"hogar_id"?: string | null,"institucion"?: string | null,"nombre"?: string | null,"saldo"?: never,"saldo_inicial"?: number | null,"tipo"?: Database["fin"]['Enums']["tipo_cuenta"] | null,"ultimos4"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"v_tarjeta": {
                  Row: {
                    "activa": boolean,"apartado": number | null,"cuenta_id": string,"cupo": number | null,"deuda": number | null,"dia_facturacion": number | null,"dia_pago": number | null,"hogar_id": string,"nombre": string,"ultimos4": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "activa"?: boolean | null,"apartado"?: never,"cuenta_id"?: string | null,"cupo"?: number | null,"deuda"?: never,"dia_facturacion"?: number | null,"dia_pago"?: number | null,"hogar_id"?: string | null,"nombre"?: string | null,"ultimos4"?: string | null
                         }
                        Update: {
                           "activa"?: boolean | null,"apartado"?: never,"cuenta_id"?: string | null,"cupo"?: number | null,"deuda"?: never,"dia_facturacion"?: number | null,"dia_pago"?: number | null,"hogar_id"?: string | null,"nombre"?: string | null,"ultimos4"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"v_transferencia_pendiente": {
                  Row: {
                    "cuenta_destino": string | null,"cuenta_origen": string,"fecha": string,"hogar_id": string,"id": string,"integrante_id": string | null,"monto_clp": number,"sobre": string | null,"tipo": Database["fin"]['Enums']["tipo_transferencia"],"vence_en": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "saldo_cuenta":
{ Args: { "p_cuenta": string,"p_hasta": string }; Returns: number
                           }
          }
          Enums: {
            "estado_movimiento": "capturado"|"por_confirmar"|"confirmado"|"conciliado"|"descartado","estado_simple": "abierto"|"resuelto"|"anulado","estado_transferencia": "pendiente"|"hecha"|"anulada","intencion": "supervivencia"|"deseo"|"cultura"|"imprevisto","moneda": "CLP"|"UF"|"USD"|"EUR","origen_movimiento": "manual"|"chat"|"foto"|"correo"|"banco"|"sistema"|"cartola","tipo_cuenta": "vista"|"ahorro"|"billetera"|"tarjeta_credito"|"inversion","tipo_deuda": "consumo"|"tarjeta"|"compra_cuotas"|"automotriz"|"hipotecario"|"educacion"|"informal"|"otra","tipo_evidencia": "foto"|"correo"|"chat"|"pdf"|"csv"|"xlsx","tipo_ingreso": "sueldo"|"honorarios_liquido"|"bono"|"gratificacion"|"reajuste"|"otro","tipo_movimiento": "gasto"|"ingreso"|"reembolso"|"ajuste"|"transferencia","tipo_transferencia": "interna"|"pago_tarjeta"|"a_personal"|"aporte_fondo"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"gob": {
          Tables: {
            "acuerdo_hogar": {
                  Row: {
                    "creado_en": string,"creado_por": string,"estado": Database["gob"]['Enums']["estado_acuerdo"],"hogar_id": string,"id": string,"resumen_cambios": string | null,"urgente": boolean,"version": number,"vigencia_desde": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por": string,"estado"?: Database["gob"]['Enums']["estado_acuerdo"],"hogar_id": string,"id"?: string,"resumen_cambios"?: string | null,"urgente"?: boolean,"version": number,"vigencia_desde": string
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string,"estado"?: Database["gob"]['Enums']["estado_acuerdo"],"hogar_id"?: string,"id"?: string,"resumen_cambios"?: string | null,"urgente"?: boolean,"version"?: number,"vigencia_desde"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "acuerdo_hogar_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "acuerdo_hogar_hogar_id_fkey"
      columns: ["hogar_id"]
isOneToOne: false
      referencedRelation: "hogar"
      referencedColumns: ["id"]
    }
                  ]
                },"consentimiento": {
                  Row: {
                    "finalidad": Database["gob"]['Enums']["finalidad_consent"],"hogar_id": string,"id": string,"otorgado_en": string,"otorgado_por_id": string,"revocado_en": string | null,"titular_id": string,"version_texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "finalidad": Database["gob"]['Enums']["finalidad_consent"],"hogar_id": string,"id"?: string,"otorgado_en"?: string,"otorgado_por_id": string,"revocado_en"?: string | null,"titular_id": string,"version_texto": string
                  }
                  Update: {
                    "finalidad"?: Database["gob"]['Enums']["finalidad_consent"],"hogar_id"?: string,"id"?: string,"otorgado_en"?: string,"otorgado_por_id"?: string,"revocado_en"?: string | null,"titular_id"?: string,"version_texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consentimiento_hogar_id_fkey"
      columns: ["hogar_id"]
isOneToOne: false
      referencedRelation: "hogar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consentimiento_otorgado_por_id_fkey"
      columns: ["otorgado_por_id"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consentimiento_titular_id_fkey"
      columns: ["titular_id"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id"]
    }
                  ]
                },"firma": {
                  Row: {
                    "comentario": string | null,"como_suplente": boolean,"decision": Database["gob"]['Enums']["decision_firma"],"firmado_en": string,"integrante_id": string,"solicitud_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comentario"?: string | null,"como_suplente"?: boolean,"decision": Database["gob"]['Enums']["decision_firma"],"firmado_en"?: string,"integrante_id": string,"solicitud_id": string
                  }
                  Update: {
                    "comentario"?: string | null,"como_suplente"?: boolean,"decision"?: Database["gob"]['Enums']["decision_firma"],"firmado_en"?: string,"integrante_id"?: string,"solicitud_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "firma_integrante_id_fkey"
      columns: ["integrante_id"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "firma_solicitud_id_fkey"
      columns: ["solicitud_id"]
isOneToOne: false
      referencedRelation: "solicitud_aprobacion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "firma_solicitud_id_fkey"
      columns: ["solicitud_id"]
isOneToOne: false
      referencedRelation: "v_solicitud"
      referencedColumns: ["id"]
    }
                  ]
                },"historial_etapa": {
                  Row: {
                    "direccion": Database["gob"]['Enums']["direccion_etapa"],"estado": Database["gob"]['Enums']["estado_etapa"],"etapa_anterior": string | null,"etapa_codigo": string,"evidencia": NonNullable<Json>,"hogar_id": string,"id": string,"origen": "humano"|"ia"|"sistema"|"externo","propuesta_en": string,"resuelta_en": string | null,"solicitud_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "direccion": Database["gob"]['Enums']["direccion_etapa"],"estado"?: Database["gob"]['Enums']["estado_etapa"],"etapa_anterior"?: string | null,"etapa_codigo": string,"evidencia"?: NonNullable<Json>,"hogar_id": string,"id"?: string,"origen": "humano"|"ia"|"sistema"|"externo","propuesta_en"?: string,"resuelta_en"?: string | null,"solicitud_id"?: string | null
                  }
                  Update: {
                    "direccion"?: Database["gob"]['Enums']["direccion_etapa"],"estado"?: Database["gob"]['Enums']["estado_etapa"],"etapa_anterior"?: string | null,"etapa_codigo"?: string,"evidencia"?: NonNullable<Json>,"hogar_id"?: string,"id"?: string,"origen"?: "humano"|"ia"|"sistema"|"externo","propuesta_en"?: string,"resuelta_en"?: string | null,"solicitud_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "historial_etapa_hogar_id_fkey"
      columns: ["hogar_id"]
isOneToOne: false
      referencedRelation: "hogar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "historial_etapa_solicitud_id_fkey"
      columns: ["solicitud_id"]
isOneToOne: false
      referencedRelation: "solicitud_aprobacion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "historial_etapa_solicitud_id_fkey"
      columns: ["solicitud_id"]
isOneToOne: false
      referencedRelation: "v_solicitud"
      referencedColumns: ["id"]
    }
                  ]
                },"hogar": {
                  Row: {
                    "actualizado_en": string,"creado_en": string,"eliminado_en": string | null,"etapa_codigo": string,"id": string,"moneda_base": Database["fin"]['Enums']["moneda"],"nombre": string,"zona_horaria": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"creado_en"?: string,"eliminado_en"?: string | null,"etapa_codigo"?: string,"id"?: string,"moneda_base"?: Database["fin"]['Enums']["moneda"],"nombre": string,"zona_horaria"?: string
                  }
                  Update: {
                    "actualizado_en"?: string,"creado_en"?: string,"eliminado_en"?: string | null,"etapa_codigo"?: string,"id"?: string,"moneda_base"?: Database["fin"]['Enums']["moneda"],"nombre"?: string,"zona_horaria"?: string
                  }
                  Relationships: [
                    
                  ]
                },"integrante": {
                  Row: {
                    "acceso_vence_en": string | null,"activo": boolean,"actualizado_en": string,"alias": string | null,"creado_en": string,"es_menor": boolean,"hogar_id": string,"horas_mes": number | null,"id": string,"nombre": string,"rol": Database["gob"]['Enums']["rol_integrante"],"suplente_de_id": string | null,"tiene_ingresos": boolean,"usuario_auth_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acceso_vence_en"?: string | null,"activo"?: boolean,"actualizado_en"?: string,"alias"?: string | null,"creado_en"?: string,"es_menor"?: boolean,"hogar_id": string,"horas_mes"?: number | null,"id"?: string,"nombre": string,"rol": Database["gob"]['Enums']["rol_integrante"],"suplente_de_id"?: string | null,"tiene_ingresos"?: boolean,"usuario_auth_id"?: string | null
                  }
                  Update: {
                    "acceso_vence_en"?: string | null,"activo"?: boolean,"actualizado_en"?: string,"alias"?: string | null,"creado_en"?: string,"es_menor"?: boolean,"hogar_id"?: string,"horas_mes"?: number | null,"id"?: string,"nombre"?: string,"rol"?: Database["gob"]['Enums']["rol_integrante"],"suplente_de_id"?: string | null,"tiene_ingresos"?: boolean,"usuario_auth_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "integrante_hogar_id_fkey"
      columns: ["hogar_id"]
isOneToOne: false
      referencedRelation: "hogar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "integrante_suplente_de_id_fkey"
      columns: ["suplente_de_id"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id"]
    }
                  ]
                },"invitacion": {
                  Row: {
                    "aceptada_en": string | null,"correo": string,"creado_en": string,"creado_por": string,"estado": string,"hogar_id": string,"id": string,"integrante_id": string,"rol": Database["gob"]['Enums']["rol_integrante"],"vence_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aceptada_en"?: string | null,"correo": string,"creado_en"?: string,"creado_por": string,"estado"?: string,"hogar_id": string,"id"?: string,"integrante_id": string,"rol": Database["gob"]['Enums']["rol_integrante"],"vence_en"?: string
                  }
                  Update: {
                    "aceptada_en"?: string | null,"correo"?: string,"creado_en"?: string,"creado_por"?: string,"estado"?: string,"hogar_id"?: string,"id"?: string,"integrante_id"?: string,"rol"?: Database["gob"]['Enums']["rol_integrante"],"vence_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitacion_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitacion_hogar_id_fkey"
      columns: ["hogar_id"]
isOneToOne: false
      referencedRelation: "hogar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitacion_integrante_id_hogar_id_fkey"
      columns: ["integrante_id","hogar_id"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id","hogar_id"]
    }
                  ]
                },"regla_hogar": {
                  Row: {
                    "acuerdo_id": string,"codigo": string,"regla_codigo": string | null,"valor": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "acuerdo_id": string,"codigo": string,"regla_codigo"?: string | null,"valor": NonNullable<Json>
                  }
                  Update: {
                    "acuerdo_id"?: string,"codigo"?: string,"regla_codigo"?: string | null,"valor"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "regla_hogar_acuerdo_id_fkey"
      columns: ["acuerdo_id"]
isOneToOne: false
      referencedRelation: "acuerdo_hogar"
      referencedColumns: ["id"]
    }
                  ]
                },"reunion": {
                  Row: {
                    "acuerdos": string | null,"agenda": NonNullable<Json>,"asistentes": (string)[],"hogar_id": string,"id": string,"periodo_id": string | null,"quorum": boolean,"realizada_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acuerdos"?: string | null,"agenda"?: NonNullable<Json>,"asistentes": (string)[],"hogar_id": string,"id"?: string,"periodo_id"?: string | null,"quorum": boolean,"realizada_en": string
                  }
                  Update: {
                    "acuerdos"?: string | null,"agenda"?: NonNullable<Json>,"asistentes"?: (string)[],"hogar_id"?: string,"id"?: string,"periodo_id"?: string | null,"quorum"?: boolean,"realizada_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reunion_hogar_id_fkey"
      columns: ["hogar_id"]
isOneToOne: false
      referencedRelation: "hogar"
      referencedColumns: ["id"]
    }
                  ]
                },"solicitud_aprobacion": {
                  Row: {
                    "aprobador_id": string | null,"creado_en": string,"escalada_a_suplente": boolean,"estado": Database["gob"]['Enums']["estado_solicitud"],"firmas_requeridas": number,"hogar_id": string,"id": string,"objeto_id": string,"objeto_tabla": string,"regla_codigo": string | null,"resuelta_en": string | null,"solicitada_por": string | null,"solicitada_por_tipo": "humano"|"ia"|"sistema"|"externo","tipo": Database["gob"]['Enums']["tipo_solicitud"],"vence_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aprobador_id"?: string | null,"creado_en"?: string,"escalada_a_suplente"?: boolean,"estado"?: Database["gob"]['Enums']["estado_solicitud"],"firmas_requeridas"?: number,"hogar_id": string,"id"?: string,"objeto_id": string,"objeto_tabla": string,"regla_codigo"?: string | null,"resuelta_en"?: string | null,"solicitada_por"?: string | null,"solicitada_por_tipo"?: "humano"|"ia"|"sistema"|"externo","tipo": Database["gob"]['Enums']["tipo_solicitud"],"vence_en": string
                  }
                  Update: {
                    "aprobador_id"?: string | null,"creado_en"?: string,"escalada_a_suplente"?: boolean,"estado"?: Database["gob"]['Enums']["estado_solicitud"],"firmas_requeridas"?: number,"hogar_id"?: string,"id"?: string,"objeto_id"?: string,"objeto_tabla"?: string,"regla_codigo"?: string | null,"resuelta_en"?: string | null,"solicitada_por"?: string | null,"solicitada_por_tipo"?: "humano"|"ia"|"sistema"|"externo","tipo"?: Database["gob"]['Enums']["tipo_solicitud"],"vence_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "solicitud_aprobacion_aprobador_id_fkey"
      columns: ["aprobador_id"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitud_aprobacion_hogar_id_fkey"
      columns: ["hogar_id"]
isOneToOne: false
      referencedRelation: "hogar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitud_aprobacion_solicitada_por_fkey"
      columns: ["solicitada_por"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id"]
    }
                  ]
                },"solicitud_derecho": {
                  Row: {
                    "creado_en": string,"cumplida_en": string | null,"estado": string,"hogar_id": string,"id": string,"plazo_legal": string,"resultado_uri": string | null,"tipo": Database["gob"]['Enums']["tipo_derecho"],"titular_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"cumplida_en"?: string | null,"estado"?: string,"hogar_id": string,"id"?: string,"plazo_legal": string,"resultado_uri"?: string | null,"tipo": Database["gob"]['Enums']["tipo_derecho"],"titular_id": string
                  }
                  Update: {
                    "creado_en"?: string,"cumplida_en"?: string | null,"estado"?: string,"hogar_id"?: string,"id"?: string,"plazo_legal"?: string,"resultado_uri"?: string | null,"tipo"?: Database["gob"]['Enums']["tipo_derecho"],"titular_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "solicitud_derecho_hogar_id_fkey"
      columns: ["hogar_id"]
isOneToOne: false
      referencedRelation: "hogar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitud_derecho_titular_id_fkey"
      columns: ["titular_id"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_solicitud": {
                  Row: {
                    "aprobador": string | null,"aprobador_id": string | null,"creado_en": string,"escalada_a_suplente": boolean,"estado": Database["gob"]['Enums']["estado_solicitud"],"firmas": Json | null,"firmas_requeridas": number,"hogar_id": string,"id": string,"objeto_id": string,"objeto_tabla": string,"regla_codigo": string | null,"solicitada_por": string | null,"solicitada_por_nombre": string | null,"tipo": Database["gob"]['Enums']["tipo_solicitud"],"vence_en": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "solicitud_aprobacion_aprobador_id_fkey"
      columns: ["aprobador_id"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitud_aprobacion_hogar_id_fkey"
      columns: ["hogar_id"]
isOneToOne: false
      referencedRelation: "hogar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitud_aprobacion_solicitada_por_fkey"
      columns: ["solicitada_por"]
isOneToOne: false
      referencedRelation: "integrante"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "decision_firma": "aprueba"|"rechaza","direccion_etapa": "inicial"|"avance"|"retroceso"|"reinicio","estado_acuerdo": "borrador"|"vigente"|"reemplazado","estado_etapa": "propuesta"|"confirmada"|"rechazada","estado_solicitud": "pendiente"|"aprobada"|"rechazada"|"vencida"|"autoaprobada","finalidad_consent": "uso_app"|"datos_menor"|"lectura_correo"|"banca_abierta"|"asesor_externo"|"analitica_ia","rol_integrante": "ORG"|"CAD"|"ING"|"MEN"|"ASE","tipo_derecho": "acceso"|"exportacion"|"rectificacion"|"borrado"|"oposicion","tipo_solicitud": "presupuesto"|"ajuste_plan"|"reasignacion"|"retiro_futuro"|"etapa"|"acuerdo"|"recuperacion"|"reapertura"|"duplicado"|"borrado_hogar"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"ia": {
          Tables: {
            "inferencia": {
                  Row: {
                    "aceptada": boolean | null,"campo": string,"confianza": number,"creado_en": string,"hogar_id": string,"id": string,"modelo": string,"movimiento_id": string,"valor_final": string | null,"valor_propuesto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aceptada"?: boolean | null,"campo": string,"confianza": number,"creado_en"?: string,"hogar_id": string,"id"?: string,"modelo": string,"movimiento_id": string,"valor_final"?: string | null,"valor_propuesto": string
                  }
                  Update: {
                    "aceptada"?: boolean | null,"campo"?: string,"confianza"?: number,"creado_en"?: string,"hogar_id"?: string,"id"?: string,"modelo"?: string,"movimiento_id"?: string,"valor_final"?: string | null,"valor_propuesto"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recomendacion": {
                  Row: {
                    "contenido": string,"creado_en": string,"decidida_en": string | null,"decidida_por": string | null,"estado": Database["ia"]['Enums']["estado_recomendacion"],"expira_en": string | null,"fuente_codigo": string | null,"hogar_id": string,"id": string,"modelo": string,"objeto_id": string | null,"objeto_tabla": string | null,"proceso": string,"propuesta": Json | null,"regla_codigo": string,"tipo": string,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contenido": string,"creado_en"?: string,"decidida_en"?: string | null,"decidida_por"?: string | null,"estado"?: Database["ia"]['Enums']["estado_recomendacion"],"expira_en"?: string | null,"fuente_codigo"?: string | null,"hogar_id": string,"id"?: string,"modelo": string,"objeto_id"?: string | null,"objeto_tabla"?: string | null,"proceso": string,"propuesta"?: Json | null,"regla_codigo": string,"tipo": string,"titulo": string
                  }
                  Update: {
                    "contenido"?: string,"creado_en"?: string,"decidida_en"?: string | null,"decidida_por"?: string | null,"estado"?: Database["ia"]['Enums']["estado_recomendacion"],"expira_en"?: string | null,"fuente_codigo"?: string | null,"hogar_id"?: string,"id"?: string,"modelo"?: string,"objeto_id"?: string | null,"objeto_tabla"?: string | null,"proceso"?: string,"propuesta"?: Json | null,"regla_codigo"?: string,"tipo"?: string,"titulo"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "estado_recomendacion": "propuesta"|"aceptada"|"rechazada"|"expirada"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"med": {
          Tables: {
            "alerta": {
                  Row: {
                    "clave_dedup": string | null,"creado_en": string,"dato": Json | null,"destinatario_id": string,"enviada_en": string | null,"estado": Database["med"]['Enums']["estado_alerta"],"fecha_local": string,"hogar_id": string,"id": string,"leida_en": string | null,"mensaje": string,"regla_codigo": string | null,"severidad": Database["med"]['Enums']["severidad"],"sobre_id": string | null,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clave_dedup"?: string | null,"creado_en"?: string,"dato"?: Json | null,"destinatario_id": string,"enviada_en"?: string | null,"estado"?: Database["med"]['Enums']["estado_alerta"],"fecha_local": string,"hogar_id": string,"id"?: string,"leida_en"?: string | null,"mensaje": string,"regla_codigo"?: string | null,"severidad": Database["med"]['Enums']["severidad"],"sobre_id"?: string | null,"tipo": string
                  }
                  Update: {
                    "clave_dedup"?: string | null,"creado_en"?: string,"dato"?: Json | null,"destinatario_id"?: string,"enviada_en"?: string | null,"estado"?: Database["med"]['Enums']["estado_alerta"],"fecha_local"?: string,"hogar_id"?: string,"id"?: string,"leida_en"?: string | null,"mensaje"?: string,"regla_codigo"?: string | null,"severidad"?: Database["med"]['Enums']["severidad"],"sobre_id"?: string | null,"tipo"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cierre": {
                  Row: {
                    "duracion_seg": number | null,"estado": Database["med"]['Enums']["estado_cierre"],"fecha_programada": string,"hogar_id": string,"id": string,"periodo_id": string,"realizado_en": string | null,"realizado_por": string | null,"responsable_id": string | null,"resumen_ia": string | null,"tipo": Database["med"]['Enums']["tipo_cierre"]
                  }
                  ComputedFields: never
                  Insert: {
                    "duracion_seg"?: number | null,"estado"?: Database["med"]['Enums']["estado_cierre"],"fecha_programada": string,"hogar_id": string,"id"?: string,"periodo_id": string,"realizado_en"?: string | null,"realizado_por"?: string | null,"responsable_id"?: string | null,"resumen_ia"?: string | null,"tipo": Database["med"]['Enums']["tipo_cierre"]
                  }
                  Update: {
                    "duracion_seg"?: number | null,"estado"?: Database["med"]['Enums']["estado_cierre"],"fecha_programada"?: string,"hogar_id"?: string,"id"?: string,"periodo_id"?: string,"realizado_en"?: string | null,"realizado_por"?: string | null,"responsable_id"?: string | null,"resumen_ia"?: string | null,"tipo"?: Database["med"]['Enums']["tipo_cierre"]
                  }
                  Relationships: [
                    
                  ]
                },"evento_recuperacion": {
                  Row: {
                    "abierto_en": string,"causa_raiz": Database["med"]['Enums']["causa_raiz"] | null,"cerrado_en": string | null,"criterio_salida": NonNullable<Json>,"escalado_desde_id": string | null,"estado": Database["med"]['Enums']["estado_recuperacion"],"fecha_reinicio": string | null,"hogar_id": string,"id": string,"nivel": Database["med"]['Enums']["nivel_recuperacion"],"periodo_id": string,"plan_accion": string | null,"regla_codigo": string,"responsable_id": string,"sobre_id": string | null,"vence_el": string
                  }
                  ComputedFields: never
                  Insert: {
                    "abierto_en"?: string,"causa_raiz"?: Database["med"]['Enums']["causa_raiz"] | null,"cerrado_en"?: string | null,"criterio_salida": NonNullable<Json>,"escalado_desde_id"?: string | null,"estado"?: Database["med"]['Enums']["estado_recuperacion"],"fecha_reinicio"?: string | null,"hogar_id": string,"id"?: string,"nivel": Database["med"]['Enums']["nivel_recuperacion"],"periodo_id": string,"plan_accion"?: string | null,"regla_codigo": string,"responsable_id": string,"sobre_id"?: string | null,"vence_el": string
                  }
                  Update: {
                    "abierto_en"?: string,"causa_raiz"?: Database["med"]['Enums']["causa_raiz"] | null,"cerrado_en"?: string | null,"criterio_salida"?: NonNullable<Json>,"escalado_desde_id"?: string | null,"estado"?: Database["med"]['Enums']["estado_recuperacion"],"fecha_reinicio"?: string | null,"hogar_id"?: string,"id"?: string,"nivel"?: Database["med"]['Enums']["nivel_recuperacion"],"periodo_id"?: string,"plan_accion"?: string | null,"regla_codigo"?: string,"responsable_id"?: string,"sobre_id"?: string | null,"vence_el"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evento_recuperacion_escalado_desde_id_fkey"
      columns: ["escalado_desde_id"]
isOneToOne: false
      referencedRelation: "evento_recuperacion"
      referencedColumns: ["id"]
    }
                  ]
                },"medicion_kpi": {
                  Row: {
                    "calculado_en": string,"detalle": Json | null,"hogar_id": string,"kpi_codigo": string,"periodo_id": string,"semaforo": Database["med"]['Enums']["severidad"] | null,"valor": number,"version_cierre": number
                  }
                  ComputedFields: never
                  Insert: {
                    "calculado_en"?: string,"detalle"?: Json | null,"hogar_id": string,"kpi_codigo": string,"periodo_id": string,"semaforo"?: Database["med"]['Enums']["severidad"] | null,"valor": number,"version_cierre"?: number
                  }
                  Update: {
                    "calculado_en"?: string,"detalle"?: Json | null,"hogar_id"?: string,"kpi_codigo"?: string,"periodo_id"?: string,"semaforo"?: Database["med"]['Enums']["severidad"] | null,"valor"?: number,"version_cierre"?: number
                  }
                  Relationships: [
                    
                  ]
                },"perfil_inicial": {
                  Row: {
                    "desde": string,"estado": string,"etapa_sugerida": string | null,"generado_en": string,"hasta": string,"hogar_id": string,"id": string,"importaciones": (string)[],"modelo": string,"perfil": NonNullable<Json>,"retroalimentacion": NonNullable<Json>,"revisado_en": string | null,"revisado_por": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "desde": string,"estado"?: string,"etapa_sugerida"?: string | null,"generado_en"?: string,"hasta": string,"hogar_id": string,"id"?: string,"importaciones": (string)[],"modelo": string,"perfil": NonNullable<Json>,"retroalimentacion": NonNullable<Json>,"revisado_en"?: string | null,"revisado_por"?: string | null,"version": number
                  }
                  Update: {
                    "desde"?: string,"estado"?: string,"etapa_sugerida"?: string | null,"generado_en"?: string,"hasta"?: string,"hogar_id"?: string,"id"?: string,"importaciones"?: (string)[],"modelo"?: string,"perfil"?: NonNullable<Json>,"retroalimentacion"?: NonNullable<Json>,"revisado_en"?: string | null,"revisado_por"?: string | null,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"reflexion": {
                  Row: {
                    "categoria_id": string | null,"cierre_id": string,"creado_en": string,"hogar_id": string,"id": string,"integrante_id": string,"pregunta": string | null,"respuesta": string | null,"valoracion": Database["med"]['Enums']["valoracion"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria_id"?: string | null,"cierre_id": string,"creado_en"?: string,"hogar_id": string,"id"?: string,"integrante_id": string,"pregunta"?: string | null,"respuesta"?: string | null,"valoracion"?: Database["med"]['Enums']["valoracion"] | null
                  }
                  Update: {
                    "categoria_id"?: string | null,"cierre_id"?: string,"creado_en"?: string,"hogar_id"?: string,"id"?: string,"integrante_id"?: string,"pregunta"?: string | null,"respuesta"?: string | null,"valoracion"?: Database["med"]['Enums']["valoracion"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reflexion_cierre_id_fkey"
      columns: ["cierre_id"]
isOneToOne: false
      referencedRelation: "cierre"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_aviso": {
                  Row: {
                    "creado_en": string,"dato": Json | null,"destinatario_id": string,"estado": Database["med"]['Enums']["estado_alerta"],"fecha_local": string,"hogar_id": string,"id": string,"leida_en": string | null,"mensaje": string,"regla_codigo": string | null,"severidad": Database["med"]['Enums']["severidad"],"sobre_id": string | null,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                           "creado_en"?: string | null,"dato"?: Json | null,"destinatario_id"?: string | null,"estado"?: Database["med"]['Enums']["estado_alerta"] | null,"fecha_local"?: string | null,"hogar_id"?: string | null,"id"?: string | null,"leida_en"?: string | null,"mensaje"?: string | null,"regla_codigo"?: string | null,"severidad"?: Database["med"]['Enums']["severidad"] | null,"sobre_id"?: string | null,"tipo"?: string | null
                         }
                        Update: {
                           "creado_en"?: string | null,"dato"?: Json | null,"destinatario_id"?: string | null,"estado"?: Database["med"]['Enums']["estado_alerta"] | null,"fecha_local"?: string | null,"hogar_id"?: string | null,"id"?: string | null,"leida_en"?: string | null,"mensaje"?: string | null,"regla_codigo"?: string | null,"severidad"?: Database["med"]['Enums']["severidad"] | null,"sobre_id"?: string | null,"tipo"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "causa_raiz": "imprevisto"|"estacional"|"subestimacion"|"impulso"|"ingreso_menor"|"otra","estado_alerta": "generada"|"enviada"|"en_resumen"|"leida"|"descartada","estado_cierre": "pendiente"|"hecho"|"atrasado"|"omitido","estado_recuperacion": "abierto"|"en_curso"|"cerrado"|"escalado","nivel_recuperacion": "N1"|"N2"|"N3"|"N4","severidad": "info"|"amarillo"|"rojo","tipo_cierre": "semanal"|"mensual","valoracion": "+"|"0"|"-"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"plan": {
          Tables: {
            "asignacion": {
                  Row: {
                    "confirmada_en": string,"confirmada_por": string,"hogar_id": string,"id": string,"ingreso_id": string,"monto_clp": number,"orden_flujo": number | null,"propuesta_por": "humano"|"ia"|"sistema"|"externo","sobre_id": string,"transferencia_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmada_en"?: string,"confirmada_por": string,"hogar_id": string,"id"?: string,"ingreso_id": string,"monto_clp": number,"orden_flujo"?: number | null,"propuesta_por"?: "humano"|"ia"|"sistema"|"externo","sobre_id": string,"transferencia_id"?: string | null
                  }
                  Update: {
                    "confirmada_en"?: string,"confirmada_por"?: string,"hogar_id"?: string,"id"?: string,"ingreso_id"?: string,"monto_clp"?: number,"orden_flujo"?: number | null,"propuesta_por"?: "humano"|"ia"|"sistema"|"externo","sobre_id"?: string,"transferencia_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "asignacion_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "sobre"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asignacion_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_ritmo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "asignacion_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_saldo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "asignacion_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_sobre"
      referencedColumns: ["id"]
    }
                  ]
                },"categoria": {
                  Row: {
                    "activa": boolean,"bloque_codigo": string,"es_cuatro_paredes": boolean,"hogar_id": string,"id": string,"intencion_default": Database["fin"]['Enums']["intencion"] | null,"nombre": string,"padre_id": string | null,"plantilla_codigo": string | null,"tipo_sobre": Database["plan"]['Enums']["tipo_sobre"]
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"bloque_codigo": string,"es_cuatro_paredes"?: boolean,"hogar_id": string,"id"?: string,"intencion_default"?: Database["fin"]['Enums']["intencion"] | null,"nombre": string,"padre_id"?: string | null,"plantilla_codigo"?: string | null,"tipo_sobre": Database["plan"]['Enums']["tipo_sobre"]
                  }
                  Update: {
                    "activa"?: boolean,"bloque_codigo"?: string,"es_cuatro_paredes"?: boolean,"hogar_id"?: string,"id"?: string,"intencion_default"?: Database["fin"]['Enums']["intencion"] | null,"nombre"?: string,"padre_id"?: string | null,"plantilla_codigo"?: string | null,"tipo_sobre"?: Database["plan"]['Enums']["tipo_sobre"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "categoria_padre_id_fkey"
      columns: ["padre_id"]
isOneToOne: false
      referencedRelation: "categoria"
      referencedColumns: ["id"]
    }
                  ]
                },"fondo": {
                  Row: {
                    "activo": boolean,"categoria_id": string,"creado_en": string,"cuenta_id": string | null,"fecha_objetivo": string | null,"hogar_id": string,"id": string,"integrante_id": string | null,"monto_objetivo": number,"nombre": string,"prioridad": number,"tipo": Database["plan"]['Enums']["tipo_fondo"]
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"categoria_id": string,"creado_en"?: string,"cuenta_id"?: string | null,"fecha_objetivo"?: string | null,"hogar_id": string,"id"?: string,"integrante_id"?: string | null,"monto_objetivo": number,"nombre": string,"prioridad"?: number,"tipo": Database["plan"]['Enums']["tipo_fondo"]
                  }
                  Update: {
                    "activo"?: boolean,"categoria_id"?: string,"creado_en"?: string,"cuenta_id"?: string | null,"fecha_objetivo"?: string | null,"hogar_id"?: string,"id"?: string,"integrante_id"?: string | null,"monto_objetivo"?: number,"nombre"?: string,"prioridad"?: number,"tipo"?: Database["plan"]['Enums']["tipo_fondo"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "fondo_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categoria"
      referencedColumns: ["id"]
    }
                  ]
                },"ingreso_esperado": {
                  Row: {
                    "cuenta_id": string | null,"descripcion": string,"dia_esperado": number | null,"es_base": boolean,"hogar_id": string,"id": string,"integrante_id": string,"monto": number,"periodicidad": Database["plan"]['Enums']["periodicidad"],"tipo_ingreso": Database["fin"]['Enums']["tipo_ingreso"],"vigente_desde": string,"vigente_hasta": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cuenta_id"?: string | null,"descripcion": string,"dia_esperado"?: number | null,"es_base"?: boolean,"hogar_id": string,"id"?: string,"integrante_id": string,"monto": number,"periodicidad"?: Database["plan"]['Enums']["periodicidad"],"tipo_ingreso": Database["fin"]['Enums']["tipo_ingreso"],"vigente_desde": string,"vigente_hasta"?: string | null
                  }
                  Update: {
                    "cuenta_id"?: string | null,"descripcion"?: string,"dia_esperado"?: number | null,"es_base"?: boolean,"hogar_id"?: string,"id"?: string,"integrante_id"?: string,"monto"?: number,"periodicidad"?: Database["plan"]['Enums']["periodicidad"],"tipo_ingreso"?: Database["fin"]['Enums']["tipo_ingreso"],"vigente_desde"?: string,"vigente_hasta"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"libro_sobre": {
                  Row: {
                    "fecha_valor": string,"hogar_id": string,"id": number,"monto_clp": number,"origen_id": string | null,"origen_tabla": string,"registrado_en": string,"sobre_id": string,"tipo": Database["plan"]['Enums']["tipo_libro"],"version_cierre": number
                  }
                  ComputedFields: never
                  Insert: {
                    "fecha_valor": string,"hogar_id": string,"id"?: number,"monto_clp": number,"origen_id"?: string | null,"origen_tabla": string,"registrado_en"?: string,"sobre_id": string,"tipo": Database["plan"]['Enums']["tipo_libro"],"version_cierre"?: number
                  }
                  Update: {
                    "fecha_valor"?: string,"hogar_id"?: string,"id"?: number,"monto_clp"?: number,"origen_id"?: string | null,"origen_tabla"?: string,"registrado_en"?: string,"sobre_id"?: string,"tipo"?: Database["plan"]['Enums']["tipo_libro"],"version_cierre"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "libro_sobre_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "sobre"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "libro_sobre_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_ritmo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "libro_sobre_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_saldo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "libro_sobre_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_sobre"
      referencedColumns: ["id"]
    }
                  ]
                },"linea_plan": {
                  Row: {
                    "aporte_calculado": number | null,"explicacion": string | null,"holgura_pct": number,"monto_proyectado": number,"monto_uf": number | null,"presupuesto_id": string,"regla_codigo": string | null,"sobre_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aporte_calculado"?: number | null,"explicacion"?: string | null,"holgura_pct"?: number,"monto_proyectado": number,"monto_uf"?: number | null,"presupuesto_id": string,"regla_codigo"?: string | null,"sobre_id": string
                  }
                  Update: {
                    "aporte_calculado"?: number | null,"explicacion"?: string | null,"holgura_pct"?: number,"monto_proyectado"?: number,"monto_uf"?: number | null,"presupuesto_id"?: string,"regla_codigo"?: string | null,"sobre_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "linea_plan_presupuesto_id_fkey"
      columns: ["presupuesto_id"]
isOneToOne: false
      referencedRelation: "presupuesto_mensual"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "linea_plan_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "sobre"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "linea_plan_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_ritmo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "linea_plan_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_saldo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "linea_plan_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_sobre"
      referencedColumns: ["id"]
    }
                  ]
                },"pago_fijo": {
                  Row: {
                    "categoria_id": string,"cuenta_id": string | null,"dia_vencimiento": number,"hogar_id": string,"id": string,"moneda": Database["fin"]['Enums']["moneda"],"monto": number,"nombre": string,"vigente_desde": string,"vigente_hasta": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria_id": string,"cuenta_id"?: string | null,"dia_vencimiento": number,"hogar_id": string,"id"?: string,"moneda"?: Database["fin"]['Enums']["moneda"],"monto": number,"nombre": string,"vigente_desde": string,"vigente_hasta"?: string | null
                  }
                  Update: {
                    "categoria_id"?: string,"cuenta_id"?: string | null,"dia_vencimiento"?: number,"hogar_id"?: string,"id"?: string,"moneda"?: Database["fin"]['Enums']["moneda"],"monto"?: number,"nombre"?: string,"vigente_desde"?: string,"vigente_hasta"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pago_fijo_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categoria"
      referencedColumns: ["id"]
    }
                  ]
                },"periodo": {
                  Row: {
                    "cerrado_en": string | null,"estado": Database["plan"]['Enums']["estado_periodo"],"hogar_id": string,"id": string,"mes": string,"reabierto_motivo": string | null,"version_cierre": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cerrado_en"?: string | null,"estado"?: Database["plan"]['Enums']["estado_periodo"],"hogar_id": string,"id"?: string,"mes": string,"reabierto_motivo"?: string | null,"version_cierre"?: number
                  }
                  Update: {
                    "cerrado_en"?: string | null,"estado"?: Database["plan"]['Enums']["estado_periodo"],"hogar_id"?: string,"id"?: string,"mes"?: string,"reabierto_motivo"?: string | null,"version_cierre"?: number
                  }
                  Relationships: [
                    
                  ]
                },"presupuesto_mensual": {
                  Row: {
                    "acuerdo_id": string | null,"aprobado_en": string | null,"aprobado_por": string | null,"creado_en": string,"estado": Database["plan"]['Enums']["estado_presupuesto"],"etapa_codigo": string,"generado_por": "humano"|"ia"|"sistema"|"externo","hogar_id": string,"id": string,"ingreso_proyectado": number,"motivo_version": string | null,"periodo_id": string,"solicitud_id": string | null,"uf_proyectada": number | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "acuerdo_id"?: string | null,"aprobado_en"?: string | null,"aprobado_por"?: string | null,"creado_en"?: string,"estado"?: Database["plan"]['Enums']["estado_presupuesto"],"etapa_codigo": string,"generado_por"?: "humano"|"ia"|"sistema"|"externo","hogar_id": string,"id"?: string,"ingreso_proyectado": number,"motivo_version"?: string | null,"periodo_id": string,"solicitud_id"?: string | null,"uf_proyectada"?: number | null,"version": number
                  }
                  Update: {
                    "acuerdo_id"?: string | null,"aprobado_en"?: string | null,"aprobado_por"?: string | null,"creado_en"?: string,"estado"?: Database["plan"]['Enums']["estado_presupuesto"],"etapa_codigo"?: string,"generado_por"?: "humano"|"ia"|"sistema"|"externo","hogar_id"?: string,"id"?: string,"ingreso_proyectado"?: number,"motivo_version"?: string | null,"periodo_id"?: string,"solicitud_id"?: string | null,"uf_proyectada"?: number | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "presupuesto_mensual_periodo_id_fkey"
      columns: ["periodo_id"]
isOneToOne: false
      referencedRelation: "periodo"
      referencedColumns: ["id"]
    }
                  ]
                },"programacion_flujo": {
                  Row: {
                    "cuenta_destino_id": string | null,"dia": number,"hogar_id": string,"id": string,"ingreso_esperado_id": string | null,"monto_clp": number,"orden": number,"presupuesto_id": string,"sobre_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cuenta_destino_id"?: string | null,"dia": number,"hogar_id": string,"id"?: string,"ingreso_esperado_id"?: string | null,"monto_clp": number,"orden": number,"presupuesto_id": string,"sobre_id": string
                  }
                  Update: {
                    "cuenta_destino_id"?: string | null,"dia"?: number,"hogar_id"?: string,"id"?: string,"ingreso_esperado_id"?: string | null,"monto_clp"?: number,"orden"?: number,"presupuesto_id"?: string,"sobre_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "programacion_flujo_ingreso_esperado_id_fkey"
      columns: ["ingreso_esperado_id"]
isOneToOne: false
      referencedRelation: "ingreso_esperado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programacion_flujo_presupuesto_id_fkey"
      columns: ["presupuesto_id"]
isOneToOne: false
      referencedRelation: "presupuesto_mensual"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programacion_flujo_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "sobre"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programacion_flujo_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_ritmo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "programacion_flujo_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_saldo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "programacion_flujo_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_sobre"
      referencedColumns: ["id"]
    }
                  ]
                },"reasignacion": {
                  Row: {
                    "aplicada_en": string | null,"autoaprobada": boolean,"creado_en": string,"evento_recuperacion_id": string | null,"hogar_id": string,"id": string,"monto_clp": number,"motivo": string | null,"periodo_id": string,"registrada_por": string,"sobre_destino_id": string,"sobre_origen_id": string,"solicitud_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aplicada_en"?: string | null,"autoaprobada"?: boolean,"creado_en"?: string,"evento_recuperacion_id"?: string | null,"hogar_id": string,"id"?: string,"monto_clp": number,"motivo"?: string | null,"periodo_id": string,"registrada_por": string,"sobre_destino_id": string,"sobre_origen_id": string,"solicitud_id"?: string | null
                  }
                  Update: {
                    "aplicada_en"?: string | null,"autoaprobada"?: boolean,"creado_en"?: string,"evento_recuperacion_id"?: string | null,"hogar_id"?: string,"id"?: string,"monto_clp"?: number,"motivo"?: string | null,"periodo_id"?: string,"registrada_por"?: string,"sobre_destino_id"?: string,"sobre_origen_id"?: string,"solicitud_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reasignacion_periodo_id_fkey"
      columns: ["periodo_id"]
isOneToOne: false
      referencedRelation: "periodo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reasignacion_sobre_destino_id_fkey"
      columns: ["sobre_destino_id"]
isOneToOne: false
      referencedRelation: "sobre"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reasignacion_sobre_destino_id_fkey"
      columns: ["sobre_destino_id"]
isOneToOne: false
      referencedRelation: "v_ritmo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "reasignacion_sobre_destino_id_fkey"
      columns: ["sobre_destino_id"]
isOneToOne: false
      referencedRelation: "v_saldo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "reasignacion_sobre_destino_id_fkey"
      columns: ["sobre_destino_id"]
isOneToOne: false
      referencedRelation: "v_sobre"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reasignacion_sobre_origen_id_fkey"
      columns: ["sobre_origen_id"]
isOneToOne: false
      referencedRelation: "sobre"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reasignacion_sobre_origen_id_fkey"
      columns: ["sobre_origen_id"]
isOneToOne: false
      referencedRelation: "v_ritmo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "reasignacion_sobre_origen_id_fkey"
      columns: ["sobre_origen_id"]
isOneToOne: false
      referencedRelation: "v_saldo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "reasignacion_sobre_origen_id_fkey"
      columns: ["sobre_origen_id"]
isOneToOne: false
      referencedRelation: "v_sobre"
      referencedColumns: ["id"]
    }
                  ]
                },"sobre": {
                  Row: {
                    "categoria_id": string | null,"cerrado": boolean,"creado_en": string,"cuenta_id": string | null,"deuda_id": string | null,"es_cuatro_paredes": boolean,"fondo_id": string | null,"hogar_id": string,"id": string,"integrante_id": string | null,"orden_flujo": number | null,"periodo_id": string,"tipo": Database["plan"]['Enums']["tipo_sobre"]
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria_id"?: string | null,"cerrado"?: boolean,"creado_en"?: string,"cuenta_id"?: string | null,"deuda_id"?: string | null,"es_cuatro_paredes"?: boolean,"fondo_id"?: string | null,"hogar_id": string,"id"?: string,"integrante_id"?: string | null,"orden_flujo"?: number | null,"periodo_id": string,"tipo": Database["plan"]['Enums']["tipo_sobre"]
                  }
                  Update: {
                    "categoria_id"?: string | null,"cerrado"?: boolean,"creado_en"?: string,"cuenta_id"?: string | null,"deuda_id"?: string | null,"es_cuatro_paredes"?: boolean,"fondo_id"?: string | null,"hogar_id"?: string,"id"?: string,"integrante_id"?: string | null,"orden_flujo"?: number | null,"periodo_id"?: string,"tipo"?: Database["plan"]['Enums']["tipo_sobre"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "sobre_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categoria"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sobre_fondo_id_fkey"
      columns: ["fondo_id"]
isOneToOne: false
      referencedRelation: "fondo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sobre_periodo_id_fkey"
      columns: ["periodo_id"]
isOneToOne: false
      referencedRelation: "periodo"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_bloques_periodo": {
                  Row: {
                    "bloque_codigo": string,"hogar_id": string,"monto": number | null,"pct_ingreso": number | null,"periodo_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "presupuesto_mensual_periodo_id_fkey"
      columns: ["periodo_id"]
isOneToOne: false
      referencedRelation: "periodo"
      referencedColumns: ["id"]
    }
                  ]
                },"v_ingreso_por_repartir": {
                  Row: {
                    "comercio": string | null,"cuenta_id": string,"diferencia_pct": number | null,"es_variable": boolean,"fecha_contable": string,"hogar_id": string,"ingreso_id": string,"integrante_id": string | null,"mes": string,"monto_clp": number,"periodo_id": string,"por_repartir": number | null,"tipo_ingreso": Database["fin"]['Enums']["tipo_ingreso"]
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "movimiento_periodo_id_fkey"
      columns: ["periodo_id"]
isOneToOne: false
      referencedRelation: "periodo"
      referencedColumns: ["id"]
    }
                  ]
                },"v_linea_plan": {
                  Row: {
                    "aporte_calculado": number | null,"bloque_codigo": string | null,"cuenta_id": string | null,"disponible": number | null,"es_cuatro_paredes": boolean,"estado_plan": Database["plan"]['Enums']["estado_presupuesto"],"explicacion": string | null,"fondo_id": string | null,"gastado": number | null,"hogar_id": string,"holgura_pct": number,"integrante_id": string | null,"monto_proyectado": number,"monto_uf": number | null,"nombre": string | null,"periodo_id": string,"presupuesto_id": string,"regla_codigo": string | null,"saldo": number | null,"sobre_id": string,"tipo": Database["plan"]['Enums']["tipo_sobre"],"version": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "linea_plan_presupuesto_id_fkey"
      columns: ["presupuesto_id"]
isOneToOne: false
      referencedRelation: "presupuesto_mensual"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "linea_plan_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "sobre"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "linea_plan_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_ritmo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "linea_plan_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_saldo_sobre"
      referencedColumns: ["sobre_id"]
    },{
      foreignKeyName: "linea_plan_sobre_id_fkey"
      columns: ["sobre_id"]
isOneToOne: false
      referencedRelation: "v_sobre"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "presupuesto_mensual_periodo_id_fkey"
      columns: ["periodo_id"]
isOneToOne: false
      referencedRelation: "periodo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sobre_fondo_id_fkey"
      columns: ["fondo_id"]
isOneToOne: false
      referencedRelation: "fondo"
      referencedColumns: ["id"]
    }
                  ]
                },"v_ritmo_sobre": {
                  Row: {
                    "dias_mes": number | null,"dias_transcurridos": number | null,"disponible": number | null,"gastado": number | null,"hogar_id": string,"mes": string,"periodo_id": string,"ritmo": number | null,"sobre_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sobre_periodo_id_fkey"
      columns: ["periodo_id"]
isOneToOne: false
      referencedRelation: "periodo"
      referencedColumns: ["id"]
    }
                  ]
                },"v_saldo_sobre": {
                  Row: {
                    "categoria_id": string | null,"disponible": number | null,"gastado": number | null,"hogar_id": string,"integrante_id": string | null,"periodo_id": string,"saldo": number | null,"sobre_id": string,"tipo": Database["plan"]['Enums']["tipo_sobre"]
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sobre_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categoria"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sobre_periodo_id_fkey"
      columns: ["periodo_id"]
isOneToOne: false
      referencedRelation: "periodo"
      referencedColumns: ["id"]
    }
                  ]
                },"v_sobre": {
                  Row: {
                    "bloque_codigo": string | null,"categoria_id": string | null,"cerrado": boolean,"cuenta_id": string | null,"disponible": number | null,"es_cuatro_paredes": boolean,"fondo_id": string | null,"gastado": number | null,"hogar_id": string,"id": string,"integrante_id": string | null,"intencion_default": Database["fin"]['Enums']["intencion"] | null,"mes": string,"nombre": string | null,"periodo_id": string,"saldo": number | null,"tipo": Database["plan"]['Enums']["tipo_sobre"]
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sobre_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categoria"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sobre_fondo_id_fkey"
      columns: ["fondo_id"]
isOneToOne: false
      referencedRelation: "fondo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sobre_periodo_id_fkey"
      columns: ["periodo_id"]
isOneToOne: false
      referencedRelation: "periodo"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "sobre_pago_tarjeta":
{ Args: { "p_cuenta": string,"p_hogar": string,"p_periodo": string }; Returns: string
                           }
          }
          Enums: {
            "estado_periodo": "abierto"|"en_cierre"|"cerrado"|"reabierto","estado_presupuesto": "borrador"|"aprobado"|"en_ejecucion"|"en_cierre"|"cerrado"|"reemplazado","periodicidad": "mensual"|"quincenal"|"semanal"|"anual"|"irregular","tipo_fondo": "gasto_verdadero"|"meta"|"emergencia"|"futuro_largo_plazo","tipo_libro": "ingreso"|"asignacion"|"reasignacion"|"imputacion"|"reembolso"|"arrastre"|"ajuste"|"reserva_tarjeta"|"pago_tarjeta","tipo_sobre": "por_asignar"|"proximo_mes"|"fijo"|"variable"|"fondo"|"futuro"|"emergencia"|"cuota"|"sin_culpa"|"mesada"|"pago_tarjeta"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"ref": {
          Tables: {
            "bloque": {
                  Row: {
                    "codigo": string,"nombre": string,"pct_limite": number,"sentido": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"nombre": string,"pct_limite": number,"sentido": string
                  }
                  Update: {
                    "codigo"?: string,"nombre"?: string,"pct_limite"?: number,"sentido"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categoria_plantilla": {
                  Row: {
                    "bloque_codigo": string,"codigo": string,"es_cuatro_paredes": boolean,"intencion_default": Database["fin"]['Enums']["intencion"] | null,"nombre": string,"tipo_sobre": Database["plan"]['Enums']["tipo_sobre"]
                  }
                  ComputedFields: never
                  Insert: {
                    "bloque_codigo": string,"codigo": string,"es_cuatro_paredes"?: boolean,"intencion_default"?: Database["fin"]['Enums']["intencion"] | null,"nombre": string,"tipo_sobre": Database["plan"]['Enums']["tipo_sobre"]
                  }
                  Update: {
                    "bloque_codigo"?: string,"codigo"?: string,"es_cuatro_paredes"?: boolean,"intencion_default"?: Database["fin"]['Enums']["intencion"] | null,"nombre"?: string,"tipo_sobre"?: Database["plan"]['Enums']["tipo_sobre"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "categoria_plantilla_bloque_codigo_fkey"
      columns: ["bloque_codigo"]
isOneToOne: false
      referencedRelation: "bloque"
      referencedColumns: ["codigo"]
    }
                  ]
                },"definicion_kpi": {
                  Row: {
                    "codigo": string,"en_mvp": boolean,"formula": string,"fuente_codigo": string | null,"grupo": string,"meta": string | null,"nombre": string,"unidad": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"en_mvp"?: boolean,"formula": string,"fuente_codigo"?: string | null,"grupo": string,"meta"?: string | null,"nombre": string,"unidad": string
                  }
                  Update: {
                    "codigo"?: string,"en_mvp"?: boolean,"formula"?: string,"fuente_codigo"?: string | null,"grupo"?: string,"meta"?: string | null,"nombre"?: string,"unidad"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "definicion_kpi_fuente_codigo_fkey"
      columns: ["fuente_codigo"]
isOneToOne: false
      referencedRelation: "fuente_metodologica"
      referencedColumns: ["codigo"]
    }
                  ]
                },"etapa": {
                  Row: {
                    "codigo": string,"criterio_entrada": NonNullable<Json>,"criterio_salida": NonNullable<Json>,"descripcion": string | null,"futuro_min_pct": number | null,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"criterio_entrada": NonNullable<Json>,"criterio_salida": NonNullable<Json>,"descripcion"?: string | null,"futuro_min_pct"?: number | null,"nombre": string,"orden": number
                  }
                  Update: {
                    "codigo"?: string,"criterio_entrada"?: NonNullable<Json>,"criterio_salida"?: NonNullable<Json>,"descripcion"?: string | null,"futuro_min_pct"?: number | null,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [
                    
                  ]
                },"feriado": {
                  Row: {
                    "fecha": string,"irrenunciable": boolean,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fecha": string,"irrenunciable"?: boolean,"nombre": string
                  }
                  Update: {
                    "fecha"?: string,"irrenunciable"?: boolean,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"flujo_etapa": {
                  Row: {
                    "destino": string,"etapa_codigo": string,"nota": string | null,"orden": number,"pct_sugerido": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "destino": string,"etapa_codigo": string,"nota"?: string | null,"orden": number,"pct_sugerido"?: number | null
                  }
                  Update: {
                    "destino"?: string,"etapa_codigo"?: string,"nota"?: string | null,"orden"?: number,"pct_sugerido"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "flujo_etapa_etapa_codigo_fkey"
      columns: ["etapa_codigo"]
isOneToOne: false
      referencedRelation: "etapa"
      referencedColumns: ["codigo"]
    }
                  ]
                },"fuente_metodologica": {
                  Row: {
                    "anio": number | null,"autor": string | null,"codigo": string,"referencia": string | null,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anio"?: number | null,"autor"?: string | null,"codigo": string,"referencia"?: string | null,"titulo": string
                  }
                  Update: {
                    "anio"?: number | null,"autor"?: string | null,"codigo"?: string,"referencia"?: string | null,"titulo"?: string
                  }
                  Relationships: [
                    
                  ]
                },"indicador_economico": {
                  Row: {
                    "codigo": string,"fecha": string,"fuente": string,"obtenido_en": string,"valor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"fecha": string,"fuente": string,"obtenido_en"?: string,"valor": number
                  }
                  Update: {
                    "codigo"?: string,"fecha"?: string,"fuente"?: string,"obtenido_en"?: string,"valor"?: number
                  }
                  Relationships: [
                    
                  ]
                },"regla_metodo": {
                  Row: {
                    "codigo": string,"enunciado": string,"estado": string,"fuente_codigo": string | null,"nivel_precedencia": number,"procesos": (string)[],"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"enunciado": string,"estado"?: string,"fuente_codigo"?: string | null,"nivel_precedencia": number,"procesos": (string)[],"version"?: number
                  }
                  Update: {
                    "codigo"?: string,"enunciado"?: string,"estado"?: string,"fuente_codigo"?: string | null,"nivel_precedencia"?: number,"procesos"?: (string)[],"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "regla_metodo_fuente_codigo_fkey"
      columns: ["fuente_codigo"]
isOneToOne: false
      referencedRelation: "fuente_metodologica"
      referencedColumns: ["codigo"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "app">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "app": {
          Enums: {
            
          }
        },"fin": {
          Enums: {
            "estado_movimiento": ["capturado", "por_confirmar", "confirmado", "conciliado", "descartado"],"estado_simple": ["abierto", "resuelto", "anulado"],"estado_transferencia": ["pendiente", "hecha", "anulada"],"intencion": ["supervivencia", "deseo", "cultura", "imprevisto"],"moneda": ["CLP", "UF", "USD", "EUR"],"origen_movimiento": ["manual", "chat", "foto", "correo", "banco", "sistema", "cartola"],"tipo_cuenta": ["vista", "ahorro", "billetera", "tarjeta_credito", "inversion"],"tipo_deuda": ["consumo", "tarjeta", "compra_cuotas", "automotriz", "hipotecario", "educacion", "informal", "otra"],"tipo_evidencia": ["foto", "correo", "chat", "pdf", "csv", "xlsx"],"tipo_ingreso": ["sueldo", "honorarios_liquido", "bono", "gratificacion", "reajuste", "otro"],"tipo_movimiento": ["gasto", "ingreso", "reembolso", "ajuste", "transferencia"],"tipo_transferencia": ["interna", "pago_tarjeta", "a_personal", "aporte_fondo"]
          }
        },"gob": {
          Enums: {
            "decision_firma": ["aprueba", "rechaza"],"direccion_etapa": ["inicial", "avance", "retroceso", "reinicio"],"estado_acuerdo": ["borrador", "vigente", "reemplazado"],"estado_etapa": ["propuesta", "confirmada", "rechazada"],"estado_solicitud": ["pendiente", "aprobada", "rechazada", "vencida", "autoaprobada"],"finalidad_consent": ["uso_app", "datos_menor", "lectura_correo", "banca_abierta", "asesor_externo", "analitica_ia"],"rol_integrante": ["ORG", "CAD", "ING", "MEN", "ASE"],"tipo_derecho": ["acceso", "exportacion", "rectificacion", "borrado", "oposicion"],"tipo_solicitud": ["presupuesto", "ajuste_plan", "reasignacion", "retiro_futuro", "etapa", "acuerdo", "recuperacion", "reapertura", "duplicado", "borrado_hogar"]
          }
        },"ia": {
          Enums: {
            "estado_recomendacion": ["propuesta", "aceptada", "rechazada", "expirada"]
          }
        },"med": {
          Enums: {
            "causa_raiz": ["imprevisto", "estacional", "subestimacion", "impulso", "ingreso_menor", "otra"],"estado_alerta": ["generada", "enviada", "en_resumen", "leida", "descartada"],"estado_cierre": ["pendiente", "hecho", "atrasado", "omitido"],"estado_recuperacion": ["abierto", "en_curso", "cerrado", "escalado"],"nivel_recuperacion": ["N1", "N2", "N3", "N4"],"severidad": ["info", "amarillo", "rojo"],"tipo_cierre": ["semanal", "mensual"],"valoracion": ["+", "0", "-"]
          }
        },"plan": {
          Enums: {
            "estado_periodo": ["abierto", "en_cierre", "cerrado", "reabierto"],"estado_presupuesto": ["borrador", "aprobado", "en_ejecucion", "en_cierre", "cerrado", "reemplazado"],"periodicidad": ["mensual", "quincenal", "semanal", "anual", "irregular"],"tipo_fondo": ["gasto_verdadero", "meta", "emergencia", "futuro_largo_plazo"],"tipo_libro": ["ingreso", "asignacion", "reasignacion", "imputacion", "reembolso", "arrastre", "ajuste", "reserva_tarjeta", "pago_tarjeta"],"tipo_sobre": ["por_asignar", "proximo_mes", "fijo", "variable", "fondo", "futuro", "emergencia", "cuota", "sin_culpa", "mesada", "pago_tarjeta"]
          }
        },"ref": {
          Enums: {
            
          }
        }
} as const
