
# Plano: Corrigir Query de Rotas GPS no Plugin BioPeakHealthKit

## Problema Identificado

O plugin nativo `BioPeakHealthKit.swift` não consegue recuperar dados de GPS porque usa o predicate incorreto para buscar rotas de workout.

### Codigo Atual (Incorreto)
```swift
// Linha 94 - BioPeakHealthKit.swift
let predicate = HKQuery.predicateForObject(with: UUID(uuidString: workoutUUID)!)
```

Este predicate busca um objeto **pelo seu proprio UUID**. Porem, `HKWorkoutRoute` tem um UUID diferente do `HKWorkout` - a rota e apenas **associada** ao workout, nao possui o mesmo identificador.

### Codigo Correto
```swift
let workoutPredicate = HKQuery.predicateForObjects(from: workout)
```

Este predicate busca objetos **associados a um workout especifico**.

## Solucao

### Passo 1: Modificar a funcao `queryWorkoutRoute`

A funcao precisa ser refatorada em duas etapas:

1. **Primeiro**: Buscar o objeto `HKWorkout` usando o UUID fornecido
2. **Depois**: Usar o workout encontrado para buscar as rotas associadas com `predicateForObjects(from:)`

### Alteracoes no Arquivo

**Arquivo**: `ios/App/App/BioPeakHealthKit.swift`

**Funcao**: `queryWorkoutRoute` (linhas 88-135)

```text
ANTES (nao funciona):
  1. Recebe workoutUUID como string
  2. Cria predicate com HKQuery.predicateForObject(with: UUID)
  3. Busca HKWorkoutRoute diretamente (falha - UUID nao corresponde)
  4. Retorna array vazio

DEPOIS (correto):
  1. Recebe workoutUUID como string
  2. Primeiro busca o HKWorkout usando predicateForObject
  3. Com o workout encontrado, usa predicateForObjects(from: workout)
  4. Busca HKWorkoutRoute com o predicate correto
  5. Extrai localizacoes da rota
  6. Retorna array com dados GPS
```

### Codigo da Correcao

```swift
@objc public func queryWorkoutRoute(_ call: CAPPluginCall) {
    guard let workoutUUIDString = call.getString("workoutUUID"),
          let workoutUUID = UUID(uuidString: workoutUUIDString) else {
        call.reject("Missing or invalid workoutUUID parameter")
        return
    }
    
    // Step 1: First, fetch the HKWorkout object using its UUID
    let workoutPredicate = HKQuery.predicateForObject(with: workoutUUID)
    let workoutQuery = HKSampleQuery(
        sampleType: HKWorkoutType.workoutType(),
        predicate: workoutPredicate,
        limit: 1,
        sortDescriptors: nil
    ) { [weak self] _, samples, error in
        
        guard let self = self,
              let workouts = samples as? [HKWorkout],
              let workout = workouts.first,
              error == nil else {
            print("[BioPeakHealthKit] Could not find workout with UUID: \(workoutUUIDString)")
            DispatchQueue.main.async {
                call.resolve(["locations": [], "error": "Workout not found"])
            }
            return
        }
        
        print("[BioPeakHealthKit] Found workout: \(workout.uuid.uuidString)")
        
        // Step 2: Query routes ASSOCIATED with this workout (correct predicate)
        let routePredicate = HKQuery.predicateForObjects(from: workout)
        let routeQuery = HKAnchoredObjectQuery(
            type: HKSeriesType.workoutRoute(),
            predicate: routePredicate,
            anchor: nil,
            limit: HKObjectQueryNoLimit
        ) { _, samples, _, _, error in
            
            guard let routes = samples as? [HKWorkoutRoute], error == nil else {
                print("[BioPeakHealthKit] No routes found for workout: \(error?.localizedDescription ?? "unknown error")")
                DispatchQueue.main.async {
                    call.resolve(["locations": []])
                }
                return
            }
            
            print("[BioPeakHealthKit] Found \(routes.count) route(s) for workout")
            
            guard let route = routes.first else {
                DispatchQueue.main.async {
                    call.resolve(["locations": []])
                }
                return
            }
            
            // Step 3: Extract location data from the route
            var locations: [[String: Any]] = []
            let locationQuery = HKWorkoutRouteQuery(route: route) { _, locationResults, done, error in
                
                if let error = error {
                    print("[BioPeakHealthKit] Route query error: \(error.localizedDescription)")
                }
                
                if let locationResults = locationResults {
                    print("[BioPeakHealthKit] Received batch of \(locationResults.count) locations")
                    for location in locationResults {
                        let locationData: [String: Any] = [
                            "latitude": location.coordinate.latitude,
                            "longitude": location.coordinate.longitude,
                            "altitude": location.altitude,
                            "timestamp": ISO8601DateFormatter().string(from: location.timestamp),
                            "speed": location.speed >= 0 ? location.speed : 0,
                            "course": location.course >= 0 ? location.course : 0,
                            "horizontalAccuracy": location.horizontalAccuracy,
                            "verticalAccuracy": location.verticalAccuracy
                        ]
                        locations.append(locationData)
                    }
                }
                
                if done {
                    print("[BioPeakHealthKit] Route query complete. Total locations: \(locations.count)")
                    DispatchQueue.main.async {
                        call.resolve(["locations": locations])
                    }
                }
            }
            
            self.healthStore.execute(locationQuery)
        }
        
        self.healthStore.execute(routeQuery)
    }
    
    healthStore.execute(workoutQuery)
}
```

## Fluxo da Correcao

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO CORRIGIDO                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Recebe: workoutUUID = "2900C1F1-4FF1-4501-A3FB-..."        │
│                         │                                       │
│                         ▼                                       │
│  2. HKSampleQuery(HKWorkoutType)                               │
│     predicate: predicateForObject(with: UUID)                   │
│     → Busca o objeto HKWorkout                                  │
│                         │                                       │
│                         ▼                                       │
│  3. Encontra: HKWorkout (objeto completo)                       │
│                         │                                       │
│                         ▼                                       │
│  4. HKAnchoredObjectQuery(HKWorkoutRoute)                       │
│     predicate: predicateForObjects(from: workout) ← CORRETO!    │
│     → Busca rotas ASSOCIADAS ao workout                         │
│                         │                                       │
│                         ▼                                       │
│  5. Encontra: HKWorkoutRoute (pode ter UUID diferente)          │
│                         │                                       │
│                         ▼                                       │
│  6. HKWorkoutRouteQuery(route)                                  │
│     → Extrai CLLocation[] da rota                               │
│                         │                                       │
│                         ▼                                       │
│  7. Retorna: Array de coordenadas GPS                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Melhorias Adicionais

### 1. Validacao de UUID
```swift
// Antes: force unwrap perigoso
UUID(uuidString: workoutUUID)!

// Depois: validacao segura
guard let workoutUUID = UUID(uuidString: workoutUUIDString) else {
    call.reject("Invalid UUID format")
    return
}
```

### 2. Tratamento de Valores Invalidos
```swift
// speed e course podem ser -1 quando invalidos
"speed": location.speed >= 0 ? location.speed : 0,
"course": location.course >= 0 ? location.course : 0,
```

### 3. Logs Detalhados
Adicionados logs em cada etapa para facilitar debug no Xcode.

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `ios/App/App/BioPeakHealthKit.swift` | Refatorar funcao `queryWorkoutRoute` |

## Apos o Deploy

Para testar a correcao:

1. Rebuild o app iOS no Xcode
2. Execute uma sincronizacao do HealthKit
3. Verifique os logs no console do Xcode
4. Confirme que `locations_count > 0` nas atividades sincronizadas

## Re-sincronizar Atividades Existentes

As atividades ja sincronizadas sem GPS precisarao ser re-sincronizadas para obter os dados de rota. Opcoes:

1. **Manual**: Usuario clica em "Sincronizar" novamente
2. **Automatico**: Adicionar logica para detectar atividades sem GPS e re-buscar

## Resumo

O problema era um **predicate incorreto** no Swift. O HealthKit usa `predicateForObjects(from: workout)` para buscar objetos associados a um workout, nao `predicateForObject(with: UUID)` que busca pelo UUID do proprio objeto. Esta correcao permite que o app recupere todos os dados de GPS que a Apple disponibiliza.
