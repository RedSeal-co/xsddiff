.PHONY: install install-npm install-tsd update-npm update-tsd
.PHONY: clean clean-obj clean-tsd clean-npm

default: compile bin/xsddiff.sh

TS_SRC=$(filter-out %.d.ts,$(wildcard bin/*.ts))
TS_OBJ=$(patsubst %.ts,%.js,$(TS_SRC)) $(patsubst %.ts,%.js.map,$(TS_SRC)) $(patsubst %.ts,%.d.ts,$(TS_SRC))
TSC=./node_modules/.bin/tsc
TSC_OPTS=--module commonjs --target ES5 --sourceMap --declaration --noEmitOnError --noImplicitAny

TSLINT=./node_modules/.bin/tslint --config tslint.json

compile: $(TS_OBJ)

%.js %.js.map %.d.ts: %.ts
	$(TSC) $(TSC_OPTS) $< || (rm -f $*.js $*.js.map $*.d.ts && false)
	$(TSLINT) $< || (rm -f $*.js $*.js.map $*.d.ts && false)

clean: clean-tsd clean-npm

clean-tsd:
	rm -rf typings

clean-npm:
	rm -rf node_modules

clean-obj:
	rm -f $(TS_OBJ)

install:
	$(MAKE) install-npm
	$(MAKE) install-tsd

install-npm:
	npm install

update-npm:
	npm-check-updates -u
	npm update

TSD=node_modules/.bin/tsd

install-tsd:
	$(TSD) reinstall

update-tsd:
	$(TSD) update -o -s

bin/xsddiff.sh : bin/xsddiff.js
	touch $@ && chmod +x $@
