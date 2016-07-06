# fsv-feature-mapping
A tool for mapping features from Fulcrum Spatial Video

## Features

* Videos uploaded to the Fulcrum server can be loaded via URL parameters. `id` (UUID of the video) & `token` (Fulcrum API token) are both required parameters.

* Videos which haven't been synced to the Fulcrum server can be loaded locally by clicking the "Local Video/Track" button. Both the video file (.mp4) and track file (.json) are required.

* Features of interest can be quickly extracted from the video playback, noted, and exported to GeoJSON.

* Exported GeoJSON features can easily be imported back into the application for review by team members.
