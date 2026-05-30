PLUGIN_ID = mattermost-video-player

.PHONY: bundle clean

bundle:
	rm -rf dist build
	mkdir -p build/$(PLUGIN_ID)/webapp
	cp plugin.json build/$(PLUGIN_ID)/
	cp webapp/main.js build/$(PLUGIN_ID)/webapp/
	mkdir -p dist
	cd build && tar -czf ../dist/$(PLUGIN_ID).tar.gz $(PLUGIN_ID)
	rm -rf build

clean:
	rm -rf dist build
