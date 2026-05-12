# =====================================================================
# HOUSE OF BEBINGTON - BACKGROUND SCANNER
# Run this via Windows Task Scheduler to scan autonomously!
# =====================================================================

$ApiKey = "6cbd5867fac1c7ea342a271600898dd9"
$TelegramBotToken = "8393406772:AAEEvxoyvv5weSH3-gDEC3fk6ldskXP6AT0" 
$TelegramChatId = "5761611308" 

$SportsToFetch = @("basketball_euroleague", "basketball_nba")
$AllMatches = @()

Write-Host "House of Bebington: Starting background scan..."

# 1. Fetch from The Odds API
foreach ($Sport in $SportsToFetch) {
    try {
        $Url = "https://api.the-odds-api.com/v4/sports/$Sport/odds/?apiKey=$ApiKey&regions=uk&markets=h2h&oddsFormat=decimal"
        $Response = Invoke-RestMethod -Uri $Url -Method Get -ErrorAction Stop

        foreach ($Game in $Response) {
            $BestOdds = @{}

            foreach ($Bookie in $Game.bookmakers) {
                # Find the h2h market
                $H2h = $Bookie.markets | Where-Object { $_.key -eq 'h2h' }
                if ($null -ne $H2h) {
                    foreach ($Outcome in $H2h.outcomes) {
                        $OutcomeName = $Outcome.name
                        $Price = $Outcome.price

                        # Track best absolute odds
                        if (-not $BestOdds.ContainsKey($OutcomeName) -or $Price -gt $BestOdds[$OutcomeName].Odds) {
                            $BestOdds[$OutcomeName] = @{
                                Outcome = $OutcomeName
                                Odds = $Price
                                Bookmaker = $Bookie.title
                            }
                        }
                    }
                }
            }

            # If we found both sides of the game
            if ($BestOdds.Count -ge 2) {
                $TotalProb = 0
                $Legs = @()
                foreach ($Key in $BestOdds.Keys) {
                    $Leg = $BestOdds[$Key]
                    $TotalProb += (1 / $Leg.Odds)
                    $Legs += $Leg
                }

                $Margin = (1 - $TotalProb) * 100
                $IsArb = $TotalProb -lt 1

                $AllMatches += @{
                    Sport = $Game.sport_title
                    Matchup = "$($Game.home_team) vs $($Game.away_team)"
                    Margin = $Margin
                    IsArb = $IsArb
                    Legs = $Legs
                }
            }
        }
        Write-Host "Successfully parsed $($Response.Count) games for $Sport"
    } catch {
        Write-Host "Failed to fetch $Sport. Error: $_"
    }
}

# 2. Find the very best match (Highest margin / Lowest vig)
if ($AllMatches.Count -gt 0) {
    $SortedMatches = $AllMatches | Sort-Object -Property Margin -Descending
    $BestMatch = $SortedMatches[0]

    $Sign = if ($BestMatch.IsArb) { "+" } else { "" }
    $Title = if ($BestMatch.IsArb) { "🚨 ARB FOUND!" } else { "📊 Best Edge Found" }
    
    $MarginFmt = "{0:N2}" -f $BestMatch.Margin
    $Message = "$Title`n$($BestMatch.Matchup)`nMargin: $Sign$MarginFmt%`n`n"

    foreach ($Leg in $BestMatch.Legs) {
        $OddsFmt = "{0:N2}" -f $Leg.Odds
        $Message += "$($Leg.Bookmaker): $($Leg.Outcome) @ $OddsFmt`n"
    }

    Write-Host "`n$Message"

    # 3. Send to Telegram
    if ($TelegramBotToken -ne "YOUR_TELEGRAM_BOT_TOKEN_HERE" -and $TelegramChatId -ne "YOUR_TELEGRAM_CHAT_ID_HERE") {
        try {
            $Uri = "https://api.telegram.org/bot$TelegramBotToken/sendMessage"
            $Body = @{
                chat_id = $TelegramChatId
                text = $Message
            }
            $JsonBody = $Body | ConvertTo-Json
            Invoke-RestMethod -Uri $Uri -Method Post -Body $JsonBody -ContentType "application/json" -ErrorAction Stop
            Write-Host "Sent to Telegram successfully."
        } catch {
            Write-Host "Failed to send to Telegram. Error: $_"
        }
    } else {
        Write-Host "Warning: Telegram credentials not set in script. Message was printed to console but not sent."
    }

} else {
    Write-Host "No valid complete matches found to calculate."
}
