# Third-party notices

## Body diagram geometry

`src/data/body.json` is derived from [MuscleMap](https://github.com/melihcolpan/MuscleMap) by Melih Colpan (MIT),
via openGym's JSON conversion. Sub-group shapes dropped, parts merged into Ethos muscle groups.

## Exercise library

`src/data/library.json` names and instructions come from
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), via
[openGym](https://github.com/DuarteSantos8/openGym). Muscles and equipment remapped to Ethos vocabulary.
Not covered by this repo's license; Animations are fetched at build time by scripts/fetch-media.sh and not committed.
