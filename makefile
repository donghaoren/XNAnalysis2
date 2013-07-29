FILES = dateformat.min.js jsfr.js timeline.min.js \
        xnanalysis2.html friendgraph.py renren_api.py \
        jquery-2.0.3.min.js style.css xnana.js

all:
	lessc style.less > style.css
	rm -rf build
	mkdir build
	cp $(FILES) build

exe:
