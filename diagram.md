@startuml
skinparam classAttributeIconSize 0

enum InvestmentBucketType {
  FIXED_INCOME
  US_STOCKS
  BITCOIN
  OTHER
}

enum Currency {
  BRL
  USD
}

enum TransactionType {
  CONTRIBUTION   ' aporte (dinheiro entrando)
  WITHDRAWAL     ' retirada (dinheiro saindo)
  INCOME         ' rendimento/dividendo/juros recebidos
  FEE            ' taxa
  TAX            ' imposto
  ADJUSTMENT     ' ajuste manual
}

enum PriceSource {
  MANUAL
  API
}

class User {
  +UUID id
  +String name
  +String email
}

class Portfolio {
  +UUID id
  +String name
  +Currency baseCurrency = BRL
}

class InvestmentBucket {
  +UUID id
  +InvestmentBucketType type
  +String name            ' ex: "Renda Fixa", "Stocks EUA"
  +Currency referenceCurrency  ' ex: USD para US_STOCKS, BRL para FIXED_INCOME
  +Boolean active
}

class BucketPosition {
  +UUID id
  +Decimal currentValue     ' valor atual NA moeda de referência (ou BRL se preferir padronizar)
  +Decimal investedValueBRL ' quanto você aportou (custo)
  +LocalDate updatedAt
  --
  +Decimal currentValueBRL(fxRate)
}

class Transaction {
  +UUID id
  +LocalDate date
  +TransactionType type
  +Decimal amount
  +Currency currency
  +Decimal fxRateToBRL      ' opcional (travar câmbio)
  +String description
  --
  +Decimal amountInBRL()
}

class BucketValuationSnapshot {
  +UUID id
  +LocalDate date
  +Decimal totalValue       ' valor total da caixinha na data (na moeda de referência)
  +Currency currency
  +PriceSource source
}

class FxRateSnapshot {
  +UUID id
  +LocalDate date
  +Currency from = USD
  +Currency to = BRL
  +Decimal rate
  +PriceSource source
}

class MonthlySummary {
  +UUID id
  +YearMonth month
  +Decimal startValueBRL
  +Decimal endValueBRL
  +Decimal netContributionBRL
  +Decimal incomeBRL
  +Decimal feesAndTaxesBRL
  +Decimal pnlBRL
  +Decimal pnlAccumulatedBRL
}

' =========================
' RELATIONSHIPS
' =========================
User "1" o-- "1..*" Portfolio

Portfolio "1" o-- "4..*" InvestmentBucket
Portfolio "1" o-- "0..*" Transaction
Portfolio "1" o-- "0..*" MonthlySummary

InvestmentBucket "1" o-- "0..1" BucketPosition
InvestmentBucket "1" o-- "0..*" BucketValuationSnapshot

Transaction "*" --> "1" InvestmentBucket

FxRateSnapshot "0..*" --> Currency

@enduml
