// AI Coach Tools Definition - Function Calling Schema
// Defines all available tools the AI Coach can use to fetch data and execute actions

export const coachTools = [
  // ==================== QUERY TOOLS ====================
  {
    type: "function",
    function: {
      name: "get_last_activity",
      description: "Busca detalhes completos da última atividade do atleta, incluindo pace, frequência cardíaca, distância, duração, cadência, elevação e análise de variação. Use quando o usuário perguntar sobre o último treino.",
      parameters: {
        type: "object",
        properties: {
          activity_type: {
            type: "string",
            enum: ["RUNNING", "TREADMILL_RUNNING", "CYCLING", "INDOOR_CYCLING", "MOUNTAIN_BIKING", "SWIMMING", "OPEN_WATER_SWIMMING", "LAP_SWIMMING", "STRENGTH_TRAINING", "YOGA", "PILATES"],
            description: "Tipo de atividade para filtrar (opcional). Se não especificado, retorna a última atividade de qualquer tipo."
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_activity_by_date",
      description: "Busca atividade em uma data específica. Use quando o usuário mencionar uma data específica como 'treino de ontem', 'atividade do dia 15/01', etc.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Data da atividade no formato YYYY-MM-DD"
          },
          activity_type: {
            type: "string",
            enum: ["RUNNING", "TREADMILL_RUNNING", "CYCLING", "INDOOR_CYCLING", "MOUNTAIN_BIKING", "SWIMMING", "OPEN_WATER_SWIMMING", "LAP_SWIMMING", "STRENGTH_TRAINING", "YOGA", "PILATES"],
            description: "Tipo de atividade para filtrar (opcional)"
          }
        },
        required: ["date"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_activities_range",
      description: "Lista atividades em um período específico. Use para análises de semana, mês, ou período personalizado.",
      parameters: {
        type: "object",
        properties: {
          start_date: {
            type: "string",
            description: "Data inicial no formato YYYY-MM-DD"
          },
          end_date: {
            type: "string",
            description: "Data final no formato YYYY-MM-DD"
          },
          activity_type: {
            type: "string",
            enum: ["RUNNING", "TREADMILL_RUNNING", "CYCLING", "INDOOR_CYCLING", "MOUNTAIN_BIKING", "SWIMMING", "OPEN_WATER_SWIMMING", "LAP_SWIMMING", "STRENGTH_TRAINING", "YOGA", "PILATES"],
            description: "Tipo de atividade para filtrar (opcional)"
          }
        },
        required: ["start_date", "end_date"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_training_plan",
      description: "Retorna o plano de treino ativo do atleta com todos os workouts programados, status de cada treino, e taxa de conclusão. Use quando o usuário perguntar sobre seu plano, próximos treinos, ou progresso.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_sleep_data",
      description: "Busca dados de sono dos últimos dias, incluindo score de sono, tempo total, sono profundo e REM. Use quando o usuário perguntar sobre sono, descanso ou recuperação.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "Número de dias para buscar (padrão: 7, máximo: 30)"
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_fitness_scores",
      description: "Retorna os scores de fitness atuais: CTL (forma crônica - 42 dias), ATL (fadiga aguda - 7 dias), TSB (frescor), e carga de treino. Use para análises de carga, fadiga e prontidão.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "Número de dias de histórico (padrão: 14)"
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_user_profile",
      description: "Busca informações do perfil do atleta: nome, idade, peso, VO2max, histórico. Use para personalizar recomendações.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_user_goals",
      description: "Retorna os objetivos e metas do atleta, incluindo provas marcadas e prazos. Use quando discutir objetivos ou planejamento.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_activities",
      description: "Compara múltiplas atividades para análise de evolução. Pode comparar por IDs específicos ou por período.",
      parameters: {
        type: "object",
        properties: {
          activity_ids: {
            type: "array",
            items: { type: "string" },
            description: "IDs das atividades para comparar (opcional)"
          },
          start_date: {
            type: "string",
            description: "Data inicial para comparar período (opcional)"
          },
          end_date: {
            type: "string",
            description: "Data final para comparar período (opcional)"
          },
          activity_type: {
            type: "string",
            enum: ["RUNNING", "CYCLING", "SWIMMING"],
            description: "Tipo de atividade para filtrar comparação"
          }
        },
        additionalProperties: false
      }
    }
  },

  // ==================== ACTION TOOLS ====================
  {
    type: "function",
    function: {
      name: "reschedule_workout",
      description: "Reagenda um treino do plano para uma nova data. Use quando o usuário pedir para mover, adiar ou antecipar um treino. IMPORTANTE: Primeiro use get_training_plan para obter a lista de treinos e seus IDs.",
      parameters: {
        type: "object",
        properties: {
          from_date: {
            type: "string",
            description: "Data original do treino a ser movido (formato YYYY-MM-DD)"
          },
          to_date: {
            type: "string",
            description: "Nova data para o treino (formato YYYY-MM-DD)"
          },
          strategy: {
            type: "string",
            enum: ["swap", "replace", "push"],
            description: "Estratégia de conflito: 'swap' troca com treino existente na data destino, 'replace' substitui treino existente, 'push' empurra treino existente para o dia seguinte"
          }
        },
        required: ["from_date", "to_date"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_custom_workout",
      description: "Cria um novo treino personalizado e adiciona ao plano do atleta. Use quando o usuário pedir para criar um treino específico.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Data do treino (formato YYYY-MM-DD)"
          },
          workout_type: {
            type: "string",
            enum: ["easy_run", "long_run", "tempo_run", "interval_training", "recovery_run", "hill_workout", "fartlek", "race_simulation", "strength", "cross_training", "rest"],
            description: "Tipo do treino"
          },
          title: {
            type: "string",
            description: "Título curto do treino (ex: 'Intervalados 6x800m')"
          },
          description: {
            type: "string",
            description: "Descrição detalhada do treino com instruções"
          },
          duration_minutes: {
            type: "number",
            description: "Duração estimada em minutos"
          },
          distance_meters: {
            type: "number",
            description: "Distância em metros (opcional)"
          },
          target_pace_min_km: {
            type: "number",
            description: "Pace alvo em min/km (opcional)"
          },
          notes: {
            type: "string",
            description: "Notas adicionais do coach"
          }
        },
        required: ["date", "workout_type", "title", "description"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "mark_workout_complete",
      description: "Marca um treino planejado como concluído. Use quando o usuário informar que completou um treino.",
      parameters: {
        type: "object",
        properties: {
          workout_date: {
            type: "string",
            description: "Data do treino a marcar como concluído (formato YYYY-MM-DD)"
          },
          notes: {
            type: "string",
            description: "Notas sobre a execução do treino (opcional)"
          },
          perceived_effort: {
            type: "number",
            description: "Percepção de esforço de 1 a 10 (opcional)"
          }
        },
        required: ["workout_date"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "skip_workout",
      description: "Pula/cancela um treino planejado com justificativa. Use quando o usuário informar que não vai fazer um treino.",
      parameters: {
        type: "object",
        properties: {
          workout_date: {
            type: "string",
            description: "Data do treino a pular (formato YYYY-MM-DD)"
          },
          reason: {
            type: "string",
            enum: ["injury", "illness", "fatigue", "schedule_conflict", "weather", "personal", "other"],
            description: "Motivo para pular o treino"
          },
          notes: {
            type: "string",
            description: "Detalhes adicionais sobre o motivo (opcional)"
          }
        },
        required: ["workout_date", "reason"],
        additionalProperties: false
      }
    }
  }
];

// Helper to get tool by name
export function getToolByName(name: string) {
  return coachTools.find(t => t.function.name === name);
}

// List of action tools that modify data
export const actionTools = [
  'reschedule_workout',
  'create_custom_workout', 
  'mark_workout_complete',
  'skip_workout'
];

// Check if a tool is an action (mutation) tool
export function isActionTool(name: string): boolean {
  return actionTools.includes(name);
}
