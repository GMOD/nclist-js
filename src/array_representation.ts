//@ts-nocheck
/**
 * @class ArrayRepr
 *
 * Class for operating on indexed array representations of objects.
 *
 * For example, if we have a lot of objects with similar attributes, e.g.:
 *
 * <pre class="code">
 *     [
 *         {start: 1, end: 2, strand: -1},
 *         {start: 5, end: 6, strand: 1},
 *         ...
 *     ]
 * </pre>
 *
 * @description
 * we can represent them more compactly (e.g., in JSON) something like this:
 *
 * <pre class="code">
 *     class = ["start", "end", "strand"]
 *     [
 *         [1, 2, -1],
 *         [5, 6, 1],
 *         ...
 *     ]
 * </pre>
 *
 * If we want to represent a few different kinds of objects in our big list,
 * we can have multiple "class" arrays, and tag each object to identify
 * which "class" array describes it.
 *
 * For example, if we have a lot of instances of a few types of objects,
 * like this:
 *
 * <pre class="code">
 *     [
 *         {start: 1, end: 2, strand: 1, id: 1},
 *         {start: 5, end: 6, strand: 1, id: 2},
 *         ...
 *         {start: 10, end: 20, chunk: 1},
 *         {start: 30, end: 40, chunk: 2},
 *         ...
 *     ]
 * </pre>
 *
 * We could use the first array position to indicate the "class" for the
 * object, like this:
 *
 * <pre class="code">
 *     classes = [["start", "end", "strand", "id"], ["start", "end", "chunk"]]
 *     [
 *         [0, 1, 2, 1, 1],
 *         [0, 5, 6, 1, 2],
 *         ...
 *         [1, 10, 20, 1],
 *         [1, 30, 40, 1]
 *     ]
 * </pre>
 *
 * Also, if we occasionally want to add an ad-hoc attribute, we could just
 * stick an optional dictionary onto the end:
 *
 * <pre class="code">
 *     classes = [["start", "end", "strand", "id"], ["start", "end", "chunk"]]
 *     [
 *         [0, 1, 2, 1, 1],
 *         [0, 5, 6, 1, 2, {foo: 1}]
 *     ]
 * </pre>
 *
 * Given that individual objects are being represented by arrays, generic
 * code needs some way to differentiate arrays that are meant to be objects
 * from arrays that are actually meant to be arrays.
 * So for each class, we include a dict with <attribute name>: true mappings
 * for each attribute that is meant to be an array.
 *
 * Also, in cases where some attribute values are the same for all objects
 * in a particular set, it may be convenient to define a "prototype"
 * with default values for all objects in the set
 *
 * In the end, we get something like this:
 *
 * <pre class="code">
 *     classes=[
 *         {'attributes': ['Start', 'End', 'Subfeatures'],
 *          'proto': {'Chrom': 'chr1'},
 *          'isArrayAttr': {Subfeatures: true}}
 *         ]
 * </pre>
 *
 * That's what this class facilitates.
 */
class ArrayRepr {
  constructor(classes) {
    this.classes = classes
    this.fields = []
    for (let cl = 0; cl < classes.length; cl += 1) {
      this.fields[cl] = {}
      for (let f = 0; f < classes[cl].attributes.length; f += 1) {
        this.fields[cl][classes[cl].attributes[f]] = f + 1
      }
      if (classes[cl].proto === undefined) {
        classes[cl].proto = {}
      }
      if (classes[cl].isArrayAttr === undefined) {
        classes[cl].isArrayAttr = {}
      }
    }
  }

  /**
   * @private
   */
  attrIndices(attr) {
    return this.classes.map(
      x =>
        x.attributes.indexOf(attr) + 1 ||
        x.attributes.indexOf(attr.toLowerCase()) + 1 ||
        undefined,
    )
  }

  get(obj, attr) {
    if (attr in this.fields[obj[0]]) {
      return obj[this.fields[obj[0]][attr]]
    }

    // try lowercase
    const lcattr = attr.toLowerCase()
    if (lcattr in this.fields[obj[0]]) {
      return obj[this.fields[obj[0]][lcattr]]
    }

    const adhocIndex = this.classes[obj[0]].attributes.length + 1
    if (adhocIndex >= obj.length || !(attr in obj[adhocIndex])) {
      if (attr in this.classes[obj[0]].proto) {
        return this.classes[obj[0]].proto[attr]
      }
      return undefined
    }
    return obj[adhocIndex][attr]
  }

  makeSetter(attr) {
    return (obj, val) => {
      this.set(obj, attr, val)
    }
  }

  makeGetter(attr) {
    return obj => {
      return this.get(obj, attr)
    }
  }

  makeFastGetter(attr) {
    // can be used only if attr is guaranteed to be in
    // the "classes" array for this object
    const indices = this.attrIndices(attr)
    return function get(obj) {
      if (indices[obj[0]] !== undefined) {
        return obj[indices[obj[0]]]
      }
      return undefined
    }
  }

  // construct(self, obj, klass) {
  //   const result = new Array(self.classes[klass].length)
  //   Object.keys(obj).forEach(attr => {
  //     this.set(result, attr, obj[attr])
  //   })
  //   return result
  // }

  /**
   * Returns fast pre-compiled getter and setter functions for use with
   * Arrays that use this representation.
   * When the returned <code>get</code> and <code>set</code> functions are
   * added as methods to an Array that contains data in this
   * representation, they provide fast access by name to the data.
   *
   * @returns {Object} <code>{ get: function() {...}, set: function(val) {...} }</code>
   *
   * @example
   * var accessors = attrs.accessors();
   * var feature = get_feature_from_someplace();
   * feature.get = accessors.get;
   * // print out the feature start and end
   * console.log( feature.get('start') + ',' + feature.get('end') );
   */
  accessors() {
    if (!this._accessors) {
      this._accessors = this._makeAccessors()
    }
    return this._accessors
  }

  /**
   * @private
   */
  _makeAccessors() {
    const indices = {}

    const accessors = {
      get(field) {
        const f = this.get.field_accessors[field.toLowerCase()]
        if (f) {
          return f.call(this)
        }
        return undefined
      },
      set(field, val) {
        const f = this.set.field_accessors[field]
        if (f) {
          return f.call(this, val)
        }
        return undefined
      },
      tags() {
        return tags[this[0]] || []
      },
    }
    accessors.get.field_accessors = {}
    accessors.set.field_accessors = {}

    // make a data structure as: { attr_name: [offset,offset,offset], }
    // that will be convenient for finding the location of the attr
    // for a given class like: indexForAttr{attrname}[classnum]
    this.classes.forEach((cdef, classnum) => {
      ;(cdef.attributes || []).forEach((attrname, offset) => {
        indices[attrname] = indices[attrname] || []
        indices[attrname][classnum] = offset + 1

        attrname = attrname.toLowerCase()

        indices[attrname] = indices[attrname] || []
        indices[attrname][classnum] = offset + 1
      })
    })

    // lowercase all the class attributes
    const tags = this.classes.map(c => c.attributes)

    // use that to make precalculated get and set accessors for each field
    Object.keys(indices).forEach(attrname => {
      const attrIndices = indices[attrname]
      // get
      accessors.get.field_accessors[attrname] = !attrIndices
        ? function get() {
            return undefined
          }
        : function get() {
            return this[attrIndices[this[0]]]
          }

      // // set
      // accessors.set.field_accessors[attrname] = !attrIndices
      //   ? () => undefined
      //   : v => {
      //       this[attrIndices[this[0]]] = v
      //       return v
      //     }
    })

    return accessors
  }
}
export default ArrayRepr

/*

Copyright (c) 2007-2010 The Evolutionary Software Foundation

Created by Mitchell Skinner <mitch_skinner@berkeley.edu>

This package and its accompanying libraries are free software; you can
redistribute it and/or modify it under the terms of the LGPL (either
version 2.1, or at your option, any later version) or the Artistic
License 2.0.  Refer to LICENSE for the full license text.

*/
