# Research notes: How to Caption Videos With Technical Terms, Names and Accents

Checked: 2026-07-31  
Backlog ID: 37  
Primary query: `accurate video transcription`

## Intent and page ownership

The reader needs to prevent and correct high-cost recognition errors in names, jargon, acronyms, code, numbers, and varied speech. The page owns the preflight terminology sheet, recording inputs, language selection, vocabulary adaptation, respectful treatment of accents/dialects, and risk-class review.

The original contribution is an evidence-backed terminology sheet plus an evidence hierarchy. It rejects aggregate “accuracy” as the only QA measure because one wrong negation or model number can be more serious than many punctuation errors.

## Primary documentation

- YouTube documents recognition problems caused by pronunciation, accents, dialects, noise, and overlapping speakers.
- W3C establishes the human accuracy check.
- Descript documents an English-only transcription glossary with current Drive-level behaviour and limits.
- Google Cloud Speech-to-Text documents model adaptation.
- Amazon Transcribe documents custom vocabularies.
- Microsoft Azure Speech documents testing and training custom speech.

The provider documentation shows that vocabulary features differ in format and scope. The draft therefore says “when supported” and never implies that a glossary guarantees correct output.

## Community evidence

Community search was qualitative and used to identify the recurring frustration around names and accented speech. The article does not rank providers based on anecdotes and never frames an accent as a speaker defect.

## Vidrial truth

Transcript correction is Available. No custom-vocabulary claim is made because that capability is not established in the canonical feature-state source. Caption animation is Beta; custom fonts and subtitle files are Coming soon.

## Review flags

Provider vocabulary limits and language coverage are drift-prone; recheck immediately before publication. A reviewer with relevant language/domain expertise should inspect examples if the final article adds specialized names or code.

