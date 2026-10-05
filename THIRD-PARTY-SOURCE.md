# Third-Party Source Availability

The DaySprig bundle includes ical.js under MPL-2.0. Its corresponding source,
including the lib directory, original distribution files, package metadata and
license, is provided without modifications in ical.js-VERSION-source.tar.gz
alongside every DaySprig release. The archive version is taken from the installed
package locked by package-lock.json, rather than assumed from a version range.

To create the archive locally, run npm ci followed by npm run release:package.
The archive is created under dist and uploaded by the release workflow.

Upstream repository: https://github.com/kewisch/ical.js
Package distribution: https://www.npmjs.com/package/ical.js

Read the complete MPL-2.0 terms in THIRD-PARTY-NOTICES.md and in the archive's
LICENSE file. Changes to ical.js covered source files must remain available under
MPL-2.0. This requirement does not change the MIT licensing of the independent
DaySprig code in this larger work.
