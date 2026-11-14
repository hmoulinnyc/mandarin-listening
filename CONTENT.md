# Mandarin listening catalog

The library includes captioned learner videos and native-audience challenges.
Creator levels and our editorial labels describe content difficulty; they are
not validated CEFR placements. The level check estimates comfortable speed and
word coverage from the captioned learner collection only.

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
the matching filter, and Everything. They do not enter the automatic zone or
plan until the learner rates one at least 75% understood. Those ratings are
saved without changing numerical speed or vocabulary estimates.

To add a measured video, prepare and verify a timestamped transcript in the
existing `s`, `e`, `t`, `w`, `p` format, with positive, ordered timings. Derive
word counts and speed from that transcript before enabling calibration. Never
invent word counts, speed, pinyin or comprehension questions from a title.

## Existing data repairs

Two Xiaogua videos titled “Advanced Beginner” are labeled Beginner rather than
Advanced. The Vietnam beginner video's malformed segment with an end earlier
than its start was dropped, remaining segments were sorted, and its counts and
speed were recomputed. Its speed is 56 wpm rather than the erroneous 158 wpm.

## Validation

Run `node --test tests/catalog.test.cjs`. No build step or package installation
is needed for the static site or these regression checks.
