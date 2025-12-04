declare module "delaunator" {
    export interface DelaunatorInstance {
        readonly triangles: Uint32Array;
        readonly halfedges: Int32Array;
        readonly hull: Uint32Array;
    }

    export interface DelaunatorFactory {
        new (coords: Float64Array): DelaunatorInstance;
        from<T>(points: ArrayLike<T>, getX?: (point: T) => number, getY?: (point: T) => number): DelaunatorInstance;
    }

    const Delaunator: DelaunatorFactory;
    export default Delaunator;
}
