# Mandarin listening catalog

The library includes captioned learner videos and native-audience challenges.
Creator levels and our editorial labels describe content difficulty; they are
not validated CEFR placements. The level check estimates comfortable speed and
word coverage from the captioned learner collection, and separately checks
native comprehension using timestamped excerpts and questions.

## Native challenges

Eight public, embeddable videos were checked against YouTube metadata on
2026-11-14. Titles, channels and durations come from that metadata. The challenge
prompts and intermediate/advanced labels are editorial selections.

| Video | Channel | Chinese YouTube caption track |
| --- | --- | --- |
| [Personal choices and expectations](https://www.youtube.com/watch?v=tzctX3Vyi90) | 大人學 | zh |
| [Moving forward without dwelling](https://www.youtube.com/watch?v=vV-Q7A7_NCE) | 大人學 | zh |
| [Ambition and stability](https://www.youtube.com/watch?v=fcXnSl5Ufzs) | 大人學 | zh |
| [Lying flat as a life choice](https://www.youtube.com/watch?v=5351okSetn0) | 大人學 | zh-TW |
| [Wages, housing and economic statistics](https://www.youtube.com/watch?v=e4E10QJszvg) | 志祺七七 | zh-TW |
| [Education across cultures](https://www.youtube.com/watch?v=gevH3h-5p6A) | 一席YiXi | zh |
| [The world of lichens](https://www.youtube.com/watch?v=eBO5xrTHuv0) | 一席YiXi | zh |
| [AI and human capabilities](https://www.youtube.com/watch?v=cd_JrPuIpsM) | TEDx Talks | None listed |

Caption metadata was readable, but caption downloads returned HTTP 429 / an IP
block. These additions therefore deliberately have `transcriptAvailable: false`,
`wpm: null`, `tokens: 0` and an empty word-frequency map. Do not treat those empty
statistics as measurements. The app uses the creator's YouTube embed and offers
its CC controls where a Chinese track was listed. There are no app pinyin,
transcript, shadowing or line-loop tools for these videos.

Unmeasured challenges are available through the feed's native-challenge link,
the matching filter, and Everything. Successful native assessment results also
recommend them in the automatic zone and plan. Supported native results focus
the default zone and weekly plan on native content, rather than inserting
beginner review videos. Older mixed plans are rebuilt for the new band, while
the full library remains available through Everything. A learner's individual rating
takes precedence for that video. These native checks and ratings do not change
numerical speed or vocabulary estimates.

To add a measured video, prepare and verify a timestamped transcript in the
existing `s`, `e`, `t`, `w`, `p` format, with positive, ordered timings. Derive
word counts and speed from that transcript before enabling numerical speed
calibration. Native comprehension-only clips may instead have a verified window
and questions. Never invent word counts, speed, pinyin or questions from a title.

## Expanded assessment (version 2)

Six native windows across five videos were reviewed from YouTube's visible,
timestamped transcript panel on 2026-11-14. The science, education and podcast
passages were read in Chinese. The 志祺七七 passage was checked using the
creator-provided English auto-translation; its source metadata records this
limitation. No new full transcript is bundled or numerical speech rate inferred.

| Source | Passage | Focus |
| --- | --- | --- |
| 大人學 EP512 | 10:14–11:32 | Limited experience and the film-preference analogy |
| 大人學 EP512 (repeat-attempt alternate) | 19:59–21:18 | Happiness, comparison and risk avoidance |
| 大人學 EP540 | 6:03–7:31 | Emotions, rumination and irreversible decisions |
| 志祺七七 | 3:00–4:16 | Controllable shocks and learned helplessness |
| 一席 / 周轶君 | 5:08–6:19 | Contrasting educational expectations |
| 一席 / 王立松 | 4:01–5:23 | Lichen habitats and limited natural resources |

Each native window has four-option detail and inference questions, with answer
keys and explanations. Feedback is withheld until both answers are collected.
The checked comprehension score is capped by the self-rating. With two
questions, both must be correct and self-rated understanding at least 75% for
a pass. A native practice band needs passing checks on at least two different
videos at that band or above. Repeated windows from one video cannot establish
the band. There is at most one window per video in a session; the EP512 alternate
rotates on the next attempt.

The standard route starts with extended learner conversations and can move to
native conversation, then native argument/explanation. Learners who already
find the collection easy can start with native clips directly. The session uses
up to six clips, moving down after weak checked answers and stopping early once
native evidence is supported and independent native sources are exhausted.
Native subtitles default to a movable cover during assessment, separate from
normal viewing preferences. The player enforces the excerpt end on replays.
Skipped/unavailable clips do not count as wrong; zero completed clips preserves
the previous result and plan. Older saved results remain readable and invite
reassessment with the harder material.

These are provisional content bands, not validated B1/B2 or CEFR scores. Source
review and software verification are complete; validation with known-level
learners is still needed. Pilot with intermediate/advanced listeners and ask
whether the chosen band and recommended whole videos feel appropriate. Watch
for guessed questions, translation ambiguities and topic-specific vocabulary;
revise the bank using that feedback before describing the result as CEFR-based.

## Existing data repairs

Two Xiaogua videos titled “Advanced Beginner” are labeled Beginner rather than
Advanced. The Vietnam beginner video's malformed segment with an end earlier
than its start was dropped, remaining segments were sorted, and its counts and
speed were recomputed. Its speed is 56 wpm rather than the erroneous 158 wpm.

## Validation

Run `node --test tests/catalog.test.cjs`. No build step or package installation
is needed for the static site or these regression checks.
